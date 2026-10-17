import { Router } from 'express';
import db from '../db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

// Dashboard summary stats & charts
router.get('/dashboard', authenticate, (req, res) => {
  const { branch_id, date_range = 'today' } = req.query;
  const branchId = branch_id && branch_id !== 'all' ? Number(branch_id) : null;

  // Compute date filter (supporting Pakistan time UTC+5 and UTC)
  let dateCondition = `(date(s.created_at, '+5 hours') = date('now', '+5 hours') OR date(s.created_at) = date('now'))`;
  let expDateCondition = `(date(e.date) = date('now', '+5 hours') OR date(e.date) = date('now'))`;
  let purDateCondition = `(date(p.created_at, '+5 hours') = date('now', '+5 hours') OR date(p.created_at) = date('now'))`;
  let retDateCondition = `(date(sr.created_at, '+5 hours') = date('now', '+5 hours') OR date(sr.created_at) = date('now'))`;

  if (date_range === '7days') {
    dateCondition = `s.created_at >= datetime('now', '-7 days')`;
    expDateCondition = `e.date >= date('now', '-7 days')`;
    purDateCondition = `p.created_at >= datetime('now', '-7 days')`;
    retDateCondition = `sr.created_at >= datetime('now', '-7 days')`;
  } else if (date_range === 'month') {
    dateCondition = `(strftime('%Y-%m', s.created_at, '+5 hours') = strftime('%Y-%m', 'now', '+5 hours') OR strftime('%Y-%m', s.created_at) = strftime('%Y-%m', 'now'))`;
    expDateCondition = `(strftime('%Y-%m', e.date) = strftime('%Y-%m', 'now', '+5 hours') OR strftime('%Y-%m', e.date) = strftime('%Y-%m', 'now'))`;
    purDateCondition = `(strftime('%Y-%m', p.created_at, '+5 hours') = strftime('%Y-%m', 'now', '+5 hours') OR strftime('%Y-%m', p.created_at) = strftime('%Y-%m', 'now'))`;
    retDateCondition = `(strftime('%Y-%m', sr.created_at, '+5 hours') = strftime('%Y-%m', 'now', '+5 hours') OR strftime('%Y-%m', sr.created_at) = strftime('%Y-%m', 'now'))`;
  }

  // Branch conditions
  const branchSalesCond = branchId ? `AND s.branch_id = ${branchId}` : '';
  const branchExpCond = branchId ? `AND e.branch_id = ${branchId}` : '';
  const branchPurCond = branchId ? `AND p.branch_id = ${branchId}` : '';
  const branchRetCond = branchId ? `AND sr.branch_id = ${branchId}` : '';

  // KPI calculations
  const salesKpi = db.prepare(`
    SELECT
      COALESCE(SUM(s.grand_total), 0) as total_sales,
      COALESCE(SUM(s.profit), 0) as total_profit,
      COUNT(s.id) as total_invoices
    FROM sales s
    WHERE ${dateCondition} ${branchSalesCond} AND s.status != 'cancelled'
  `).get();

  const retKpi = db.prepare(`
    SELECT
      COALESCE(SUM(sr.refund_amount), 0) as total_returns,
      COUNT(sr.id) as total_returns_count
    FROM sales_returns sr
    WHERE ${retDateCondition} ${branchRetCond}
  `).get();

  const retProfitKpi = db.prepare(`
    SELECT
      COALESCE(SUM(sri.refund_total - (sri.quantity * COALESCE(si.purchase_price, 0))), 0) as returned_profit
    FROM sales_return_items sri
    JOIN sales_returns sr ON sri.return_id = sr.id
    LEFT JOIN sale_items si ON sri.sale_item_id = si.id
    WHERE ${retDateCondition} ${branchRetCond}
  `).get();

  const returnedInvoicesCount = db.prepare(`
    SELECT COUNT(s.id) as count
    FROM sales s
    WHERE ${dateCondition} ${branchSalesCond} AND s.status = 'returned'
  `).get().count;

  const netSales = Math.max(0, salesKpi.total_sales - retKpi.total_returns);
  const netGrossProfit = Math.max(0, salesKpi.total_profit - retProfitKpi.returned_profit);
  const activeInvoices = Math.max(0, salesKpi.total_invoices - returnedInvoicesCount);

  const expKpi = db.prepare(`
    SELECT COALESCE(SUM(e.amount), 0) as total_expenses
    FROM expenses e
    WHERE ${expDateCondition} ${branchExpCond}
  `).get();

  const purKpi = db.prepare(`
    SELECT COALESCE(SUM(p.grand_total), 0) as total_purchases
    FROM purchases p
    WHERE ${purDateCondition} ${branchPurCond}
  `).get();

  // Cash in Hand (active open register or sum across open registers)
  const openCash = db.prepare(`
    SELECT COALESCE(SUM(expected_cash), 0) as cash_in_hand
    FROM cash_registers
    WHERE status = 'open' ${branchId ? `AND branch_id = ${branchId}` : ''}
  `).get().cash_in_hand;

  // Counts
  const totalProducts = db.prepare("SELECT COUNT(*) as count FROM products WHERE status = 'active'").get().count;

  const lowStockCount = db.prepare(`
    SELECT COUNT(*) as count FROM products p
    JOIN branch_inventory bi ON bi.product_id = p.id
    WHERE p.status = 'active'
      ${branchId ? `AND bi.branch_id = ${branchId}` : ''}
      AND bi.quantity <= p.min_stock AND bi.quantity > 0
  `).get().count;

  const outOfStockCount = db.prepare(`
    SELECT COUNT(*) as count FROM products p
    JOIN branch_inventory bi ON bi.product_id = p.id
    WHERE p.status = 'active'
      ${branchId ? `AND bi.branch_id = ${branchId}` : ''}
      AND bi.quantity <= 0
  `).get().count;

  const totalCustomers = db.prepare("SELECT COUNT(*) as count FROM customers WHERE status = 'active'").get().count;
  const totalSuppliers = db.prepare("SELECT COUNT(*) as count FROM suppliers WHERE status = 'active'").get().count;
  const totalCustomerCredit = db.prepare("SELECT COALESCE(SUM(current_balance), 0) as credit FROM customers WHERE status = 'active'").get().credit;
  const totalSupplierPayable = db.prepare("SELECT COALESCE(SUM(current_balance), 0) as payable FROM suppliers WHERE status = 'active'").get().payable;

  // Multi-branch comparison (deducting branch returns)
  const branches = db.prepare("SELECT id, name, code FROM branches WHERE status = 'active' ORDER BY id ASC").all();
  const branchComparison = branches.map(b => {
    const sRow = db.prepare(`
      SELECT
        COALESCE(SUM(s.grand_total), 0) as sales_amount,
        COUNT(s.id) as invoice_count,
        COALESCE(SUM(s.profit), 0) as profit_amount
      FROM sales s
      WHERE s.branch_id = ? AND ${dateCondition} AND s.status != 'cancelled'
    `).get(b.id);

    const rRow = db.prepare(`
      SELECT
        COALESCE(SUM(sr.refund_amount), 0) as ret_amount,
        COALESCE(SUM(sri.refund_total - (sri.quantity * COALESCE(si.purchase_price, 0))), 0) as ret_profit
      FROM sales_returns sr
      LEFT JOIN sales_return_items sri ON sri.return_id = sr.id
      LEFT JOIN sale_items si ON sri.sale_item_id = si.id
      WHERE sr.branch_id = ? AND ${retDateCondition}
    `).get(b.id);

    return {
      id: b.id,
      name: b.name,
      code: b.code,
      sales_amount: Math.max(0, sRow.sales_amount - rRow.ret_amount),
      invoice_count: sRow.invoice_count,
      profit_amount: Math.max(0, sRow.profit_amount - rRow.ret_profit)
    };
  });

  // Payment methods breakdown (deducting refunds by payment method)
  const rawPaymentMethods = db.prepare(`
    SELECT s.payment_method, COUNT(s.id) as count, COALESCE(SUM(s.grand_total), 0) as total
    FROM sales s
    WHERE ${dateCondition} ${branchSalesCond} AND s.status != 'cancelled'
    GROUP BY s.payment_method
  `).all();

  const rawRefundMethods = db.prepare(`
    SELECT sr.refund_method as payment_method, COALESCE(SUM(sr.refund_amount), 0) as refund_total
    FROM sales_returns sr
    WHERE ${retDateCondition} ${branchRetCond}
    GROUP BY sr.refund_method
  `).all();

  const refundMap = {};
  rawRefundMethods.forEach(r => { refundMap[r.payment_method] = (refundMap[r.payment_method] || 0) + r.refund_total; });

  const paymentMethods = rawPaymentMethods.map(pm => {
    const refunded = refundMap[pm.payment_method] || 0;
    return {
      payment_method: pm.payment_method,
      count: pm.count,
      total: Math.max(0, pm.total - refunded)
    };
  }).filter(pm => pm.total > 0 || pm.count > 0);

  // Top selling products (deducting returned quantities and excluding fully returned items)
  const topProducts = db.prepare(`
    SELECT
      si.product_name,
      si.unit,
      SUM(si.quantity - COALESCE(si.returned_quantity, 0)) as total_qty,
      SUM(
        CASE
          WHEN si.quantity > 0 THEN
            (si.line_total / si.quantity) * (si.quantity - COALESCE(si.returned_quantity, 0))
          ELSE 0
        END
      ) as total_revenue
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    WHERE ${dateCondition} ${branchSalesCond} AND s.status != 'cancelled'
    GROUP BY si.product_id
    HAVING total_qty > 0
    ORDER BY total_revenue DESC
    LIMIT 6
  `).all();

  // Recent 7 Days Sales Trend (daily sales - daily returns)
  const salesTrend = db.prepare(`
    SELECT
      d.sale_date,
      MAX(0, COALESCE(s.daily_sales, 0) - COALESCE(r.daily_returns, 0)) as total,
      COALESCE(s.daily_count, 0) as count
    FROM (
      SELECT date(created_at) as sale_date FROM sales WHERE created_at >= datetime('now', '-7 days')
      UNION
      SELECT date(created_at) as sale_date FROM sales_returns WHERE created_at >= datetime('now', '-7 days')
    ) d
    LEFT JOIN (
      SELECT date(created_at) as s_date, SUM(grand_total) as daily_sales, COUNT(id) as daily_count
      FROM sales
      WHERE created_at >= datetime('now', '-7 days') ${branchId ? `AND branch_id = ${branchId}` : ''} AND status != 'cancelled'
      GROUP BY date(created_at)
    ) s ON d.sale_date = s.s_date
    LEFT JOIN (
      SELECT date(created_at) as r_date, SUM(refund_amount) as daily_returns
      FROM sales_returns
      WHERE created_at >= datetime('now', '-7 days') ${branchId ? `AND branch_id = ${branchId}` : ''}
      GROUP BY date(created_at)
    ) r ON d.sale_date = r.r_date
    ORDER BY d.sale_date ASC
  `).all();

  // Critical Low Stock Alerts preview
  const stockAlerts = db.prepare(`
    SELECT p.name, p.code, p.unit, p.min_stock, b.name as branch_name, bi.quantity as stock
    FROM products p
    JOIN branch_inventory bi ON bi.product_id = p.id
    JOIN branches b ON bi.branch_id = b.id
    WHERE p.status = 'active' AND bi.quantity <= p.min_stock
    ${branchId ? `AND bi.branch_id = ${branchId}` : ''}
    ORDER BY bi.quantity ASC
    LIMIT 5
  `).all();

  res.json({
    kpis: {
      total_sales: netSales,
      gross_sales: salesKpi.total_sales,
      total_returns: retKpi.total_returns,
      total_returns_count: retKpi.total_returns_count,
      total_profit: req.user.role === 'cashier' ? 0 : netGrossProfit,
      total_invoices: salesKpi.total_invoices,
      active_invoices: activeInvoices,
      returned_invoices: returnedInvoicesCount,
      total_expenses: expKpi.total_expenses,
      total_purchases: purKpi.total_purchases,
      net_profit: req.user.role === 'cashier' ? 0 : (netGrossProfit - expKpi.total_expenses),
      cash_in_hand: openCash,
      total_products: totalProducts,
      low_stock_count: lowStockCount,
      out_of_stock_count: outOfStockCount,
      total_customers: totalCustomers,
      total_suppliers: totalSuppliers,
      pending_customer_credit: totalCustomerCredit,
      pending_supplier_payables: totalSupplierPayable
    },
    branch_comparison: branchComparison,
    payment_methods: paymentMethods,
    top_products: topProducts,
    sales_trend: salesTrend,
    stock_alerts: stockAlerts
  });
});

// Comprehensive Multi-Report Generator (All 19 Reports)
router.get('/data', authenticate, requirePermission('view_reports'), (req, res) => {
  const { report_type = 'daily_sales', branch_id, date_from, date_to, category_id, user_id } = req.query;
  const branchId = branch_id && branch_id !== 'all' ? Number(branch_id) : null;

  let branchClause = branchId ? `AND branch_id = ${branchId}` : '';
  let dateClause = '';
  if (date_from && date_to) {
    dateClause = `AND date(created_at) BETWEEN date('${date_from}') AND date('${date_to}')`;
  } else if (date_from) {
    dateClause = `AND date(created_at) >= date('${date_from}')`;
  } else if (date_to) {
    dateClause = `AND date(created_at) <= date('${date_to}')`;
  }

  let results = [];
  let summary = {};

  switch (report_type) {
    case 'daily_sales':
    case 'weekly_sales':
    case 'monthly_sales':
    case 'custom_sales': {
      results = db.prepare(`
        SELECT date(s.created_at) as date, b.name as branch_name,
               COUNT(s.id) as invoice_count,
               COALESCE(SUM(s.subtotal), 0) as subtotal,
               COALESCE(SUM(s.discount_amount), 0) as total_discount,
               COALESCE(SUM(s.tax_amount), 0) as total_tax,
               COALESCE(SUM(s.grand_total), 0) as grand_total,
               COALESCE(SUM(s.paid_amount), 0) as cash_received,
               COALESCE(SUM(s.credit_amount), 0) as udhaar_amount,
               COALESCE(SUM(s.profit), 0) as gross_profit
        FROM sales s
        JOIN branches b ON s.branch_id = b.id
        WHERE s.status != 'cancelled' ${branchClause} ${dateClause}
        GROUP BY date(s.created_at), s.branch_id
        ORDER BY date(s.created_at) DESC
      `).all();
      break;
    }

    case 'profit_loss': {
      const retDateClause = date_from && date_to ? `AND date(sr.created_at) BETWEEN date('${date_from}') AND date('${date_to}')` : (date_from ? `AND date(sr.created_at) >= date('${date_from}')` : (date_to ? `AND date(sr.created_at) <= date('${date_to}')` : ''));
      const retBranchClause = branchId ? `AND sr.branch_id = ${branchId}` : '';

      const retTotal = db.prepare(`
        SELECT COALESCE(SUM(sr.refund_amount), 0) as total_refund,
               COALESCE(SUM(sri.refund_total - (sri.quantity * COALESCE(si.purchase_price, 0))), 0) as profit_refund
        FROM sales_returns sr
        LEFT JOIN sales_return_items sri ON sri.return_id = sr.id
        LEFT JOIN sale_items si ON sri.sale_item_id = si.id
        WHERE 1=1 ${retBranchClause} ${retDateClause}
      `).get();

      const salesTotal = db.prepare(`
        SELECT COALESCE(SUM(grand_total), 0) as sales,
               COALESCE(SUM(total_cost), 0) as cogs,
               COALESCE(SUM(profit), 0) as gross_profit
        FROM sales WHERE status != 'cancelled' ${branchClause} ${dateClause}
      `).get();

      const expDateClause = date_from && date_to ? `AND date(date) BETWEEN date('${date_from}') AND date('${date_to}')` : '';
      const expTotal = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as expenses
        FROM expenses WHERE 1=1 ${branchClause} ${expDateClause}
      `).get().expenses;

      const netSales = Math.max(0, salesTotal.sales - retTotal.total_refund);
      const netGrossProfit = Math.max(0, salesTotal.gross_profit - retTotal.profit_refund);

      summary = {
        gross_sales: salesTotal.sales,
        returns_amount: retTotal.total_refund,
        net_sales: netSales,
        cost_of_goods_sold: salesTotal.cogs,
        gross_profit: netGrossProfit,
        total_expenses: expTotal,
        net_profit: netGrossProfit - expTotal,
        profit_margin: netSales > 0 ? (((netGrossProfit - expTotal) / netSales) * 100).toFixed(1) : '0'
      };

      results = db.prepare(`
        SELECT date(s.created_at) as date,
               COALESCE(SUM(s.grand_total), 0) as sales,
               COALESCE(SUM(s.total_cost), 0) as cogs,
               COALESCE(SUM(s.profit), 0) as gross_profit
        FROM sales s
        WHERE s.status != 'cancelled' ${branchClause} ${dateClause}
        GROUP BY date(s.created_at)
        ORDER BY date(s.created_at) DESC
      `).all();
      break;
    }

    case 'purchases': {
      results = db.prepare(`
        SELECT p.purchase_no, p.created_at, b.name as branch_name, s.name as supplier_name,
               p.subtotal, p.discount_amount, p.grand_total, p.paid_amount, p.remaining_amount, p.payment_method
        FROM purchases p
        JOIN branches b ON p.branch_id = b.id
        JOIN suppliers s ON p.supplier_id = s.id
        WHERE 1=1 ${branchClause} ${dateClause.replace(/created_at/g, 'p.created_at')}
        ORDER BY p.created_at DESC
      `).all();
      break;
    }

    case 'expenses': {
      const expDateClause = date_from && date_to ? `AND date(e.date) BETWEEN date('${date_from}') AND date('${date_to}')` : '';
      results = db.prepare(`
        SELECT e.expense_no, e.date, b.name as branch_name, e.category, e.title, e.amount, e.payment_method, e.paid_to, e.notes
        FROM expenses e
        JOIN branches b ON e.branch_id = b.id
        WHERE 1=1 ${branchClause.replace(/branch_id/g, 'e.branch_id')} ${expDateClause}
        ORDER BY e.date DESC
      `).all();
      break;
    }

    case 'inventory':
    case 'low_stock':
    case 'out_of_stock': {
      let filterCond = '';
      if (report_type === 'low_stock') filterCond = 'AND bi.quantity <= p.min_stock AND bi.quantity > 0';
      if (report_type === 'out_of_stock') filterCond = 'AND bi.quantity <= 0';

      results = db.prepare(`
        SELECT p.code, p.name, p.unit, c.name as category, b.name as branch_name,
               bi.quantity as stock, p.min_stock, p.purchase_price, p.sale_price,
               (bi.quantity * p.purchase_price) as cost_value,
               (bi.quantity * p.sale_price) as retail_value
        FROM products p
        JOIN branch_inventory bi ON bi.product_id = p.id
        JOIN branches b ON bi.branch_id = b.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.status = 'active' ${branchClause.replace(/branch_id/g, 'bi.branch_id')} ${filterCond}
        ORDER BY bi.quantity ASC, p.name ASC
      `).all();
      break;
    }

    case 'product_sales': {
      results = db.prepare(`
        SELECT p.code, si.product_name, p.unit, c.name as category,
               SUM(si.quantity - COALESCE(si.returned_quantity, 0)) as total_sold,
               SUM(
                 CASE
                   WHEN si.quantity > 0 THEN
                     (si.line_total / si.quantity) * (si.quantity - COALESCE(si.returned_quantity, 0))
                   ELSE 0
                 END
               ) as total_revenue,
               SUM((si.quantity - COALESCE(si.returned_quantity, 0)) * si.purchase_price) as total_cost,
               SUM(
                 CASE
                   WHEN si.quantity > 0 THEN
                     ((si.line_total / si.quantity) * (si.quantity - COALESCE(si.returned_quantity, 0))) -
                     ((si.quantity - COALESCE(si.returned_quantity, 0)) * si.purchase_price)
                   ELSE 0
                 END
               ) as gross_profit
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        JOIN products p ON si.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE s.status != 'cancelled' ${branchClause.replace(/branch_id/g, 's.branch_id')} ${dateClause.replace(/created_at/g, 's.created_at')}
        GROUP BY si.product_id
        HAVING total_sold > 0
        ORDER BY total_revenue DESC
      `).all();
      break;
    }

    case 'customers':
    case 'credit_udhaar': {
      results = db.prepare(`
        SELECT c.name, c.phone, c.address, c.credit_limit, c.current_balance as udhaar_balance,
               COUNT(s.id) as total_orders,
               COALESCE(SUM(s.grand_total), 0) as total_spent
        FROM customers c
        LEFT JOIN sales s ON s.customer_id = c.id
        WHERE c.status = 'active' ${report_type === 'credit_udhaar' ? 'AND c.current_balance > 0' : ''}
        GROUP BY c.id
        ORDER BY c.current_balance DESC, total_spent DESC
      `).all();
      break;
    }

    case 'suppliers': {
      results = db.prepare(`
        SELECT s.name, s.company, s.phone, s.current_balance as outstanding_payable,
               COUNT(p.id) as total_purchases,
               COALESCE(SUM(p.grand_total), 0) as total_purchased_amount
        FROM suppliers s
        LEFT JOIN purchases p ON p.supplier_id = s.id
        WHERE s.status = 'active'
        GROUP BY s.id
        ORDER BY s.current_balance DESC
      `).all();
      break;
    }

    case 'sales_returns': {
      results = db.prepare(`
        SELECT sr.return_no, sr.created_at, b.name as branch_name, s.invoice_no,
               c.name as customer_name, sr.refund_amount, sr.refund_method, sr.reason, u.name as cashier_name
        FROM sales_returns sr
        JOIN branches b ON sr.branch_id = b.id
        JOIN sales s ON sr.sale_id = s.id
        LEFT JOIN customers c ON sr.customer_id = c.id
        JOIN users u ON sr.user_id = u.id
        WHERE 1=1 ${branchClause.replace(/branch_id/g, 'sr.branch_id')} ${dateClause.replace(/created_at/g, 'sr.created_at')}
        ORDER BY sr.created_at DESC
      `).all();
      break;
    }

    case 'purchase_returns': {
      results = db.prepare(`
        SELECT pr.return_no, pr.created_at, b.name as branch_name, s.name as supplier_name,
               pr.total_amount, pr.reason, u.name as user_name
        FROM purchase_returns pr
        JOIN branches b ON pr.branch_id = b.id
        JOIN suppliers s ON pr.supplier_id = s.id
        JOIN users u ON pr.user_id = u.id
        WHERE 1=1 ${branchClause.replace(/branch_id/g, 'pr.branch_id')} ${dateClause.replace(/created_at/g, 'pr.created_at')}
        ORDER BY pr.created_at DESC
      `).all();
      break;
    }

    case 'cashiers': {
      results = db.prepare(`
        SELECT u.id, u.name as cashier_name, u.username, b.name as branch_name,
               COUNT(s.id) as total_sales_count,
               COALESCE(SUM(s.grand_total), 0) as total_revenue,
               COALESCE(SUM(s.discount_amount), 0) as total_discount_given
        FROM users u
        LEFT JOIN sales s ON s.user_id = u.id AND s.status != 'cancelled' ${dateClause.replace(/created_at/g, 's.created_at')}
        LEFT JOIN branches b ON u.branch_id = b.id
        WHERE u.status = 'active'
        GROUP BY u.id
        ORDER BY total_revenue DESC
      `).all();
      break;
    }

    case 'branches': {
      results = db.prepare(`
        SELECT b.id, b.name, b.code, b.manager_name,
               COUNT(s.id) as total_invoices,
               COALESCE(SUM(s.grand_total), 0) as total_sales,
               COALESCE(SUM(s.profit), 0) as total_profit,
               (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE branch_id = b.id) as total_expenses,
               (SELECT COALESCE(SUM(grand_total), 0) FROM purchases WHERE branch_id = b.id) as total_purchases
        FROM branches b
        LEFT JOIN sales s ON s.branch_id = b.id AND s.status != 'cancelled' ${dateClause.replace(/created_at/g, 's.created_at')}
        WHERE b.status = 'active'
        GROUP BY b.id
        ORDER BY total_sales DESC
      `).all();
      break;
    }

    case 'payment_methods': {
      results = db.prepare(`
        SELECT s.payment_method, COUNT(*) as transaction_count,
               COALESCE(SUM(s.grand_total), 0) as total_amount
        FROM sales s
        WHERE s.status != 'cancelled' ${branchClause.replace(/branch_id/g, 's.branch_id')} ${dateClause.replace(/created_at/g, 's.created_at')}
        GROUP BY s.payment_method
        ORDER BY total_amount DESC
      `).all();
      break;
    }

    default:
      results = [];
  }

  res.json({ report_type, results, summary });
});

// CSV Export Endpoint
router.get('/export-csv', authenticate, requirePermission('view_reports'), (req, res) => {
  const { report_type = 'daily_sales', branch_id, date_from, date_to } = req.query;

  // Let's generate CSV directly
  const branchId = branch_id && branch_id !== 'all' ? Number(branch_id) : null;
  const branchClause = branchId ? `AND branch_id = ${branchId}` : '';

  let rows = [];
  let filename = `${report_type}_report_${new Date().toISOString().slice(0, 10)}.csv`;

  if (report_type.includes('sales')) {
    rows = db.prepare(`
      SELECT s.invoice_no, s.created_at, b.name as branch, c.name as customer,
             s.grand_total, s.paid_amount, s.payment_method, s.status
      FROM sales s
      JOIN branches b ON s.branch_id = b.id
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE 1=1 ${branchClause.replace(/branch_id/g, 's.branch_id')}
      ORDER BY s.created_at DESC
    `).all();
  } else if (report_type === 'inventory') {
    rows = db.prepare(`
      SELECT p.code, p.name, p.unit, b.name as branch, bi.quantity as stock, p.sale_price
      FROM products p
      JOIN branch_inventory bi ON bi.product_id = p.id
      JOIN branches b ON bi.branch_id = b.id
      WHERE p.status = 'active' ${branchClause.replace(/branch_id/g, 'bi.branch_id')}
    `).all();
  } else if (report_type === 'expenses') {
    rows = db.prepare(`
      SELECT e.expense_no, e.date, b.name as branch, e.category, e.title, e.amount, e.paid_to
      FROM expenses e
      JOIN branches b ON e.branch_id = b.id
      WHERE 1=1 ${branchClause.replace(/branch_id/g, 'e.branch_id')}
    `).all();
  } else {
    rows = db.prepare(`
      SELECT s.invoice_no, s.created_at, s.grand_total, s.payment_method FROM sales s LIMIT 100
    `).all();
  }

  if (rows.length === 0) {
    return res.status(200).send('No data available for export');
  }

  const headers = Object.keys(rows[0]).join(',');
  const csvLines = rows.map(r => Object.values(r).map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
  const csvData = [headers, ...csvLines].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(csvData);
});

export default router;
