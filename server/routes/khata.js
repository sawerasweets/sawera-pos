import { Router } from 'express';
import db, { logAudit } from '../db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

// 1. Get all Khata Accounts with Filters and Summary
router.get('/', authenticate, (req, res) => {
  try {
    const { search, type, status, branch_id } = req.query;

    let query = `
      SELECT
        k.*,
        b.name as branch_name,
        (SELECT COUNT(*) FROM khata_entries WHERE account_id = k.id) as total_entries,
        (SELECT MAX(entry_date) FROM khata_entries WHERE account_id = k.id) as last_entry_date
      FROM khata_accounts k
      LEFT JOIN branches b ON k.branch_id = b.id
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      query += ` AND (k.name LIKE ? OR k.phone LIKE ? OR k.notes LIKE ?)`;
      params.push(s, s, s);
    }

    if (type && type !== 'all') {
      query += ` AND k.type = ?`;
      params.push(type);
    }

    if (status && status !== 'all') {
      query += ` AND k.status = ?`;
      params.push(status);
    }

    if (branch_id && branch_id !== 'all') {
      query += ` AND (k.branch_id = ? OR k.branch_id IS NULL)`;
      params.push(Number(branch_id));
    }

    query += ` ORDER BY k.current_balance DESC, k.updated_at DESC`;

    const accounts = db.prepare(query).all(...params);

    // Calculate Global Summaries
    const summaryRow = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'payable' AND status = 'active' THEN current_balance ELSE 0 END), 0) as total_payable,
        COALESCE(SUM(CASE WHEN type = 'receivable' AND status = 'active' THEN current_balance ELSE 0 END), 0) as total_receivable,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_accounts,
        COUNT(CASE WHEN status = 'settled' THEN 1 END) as settled_accounts,
        COUNT(id) as total_accounts
      FROM khata_accounts
    `).get();

    res.json({
      accounts,
      summary: {
        total_payable: summaryRow.total_payable,
        total_receivable: summaryRow.total_receivable,
        net_balance: summaryRow.total_receivable - summaryRow.total_payable,
        active_accounts: summaryRow.active_accounts,
        settled_accounts: summaryRow.settled_accounts,
        total_accounts: summaryRow.total_accounts
      }
    });
  } catch (err) {
    console.error('Error fetching khata accounts:', err);
    res.status(500).json({ error: 'Failed to load khata accounts.' });
  }
});

// 2. Get Single Account with its Complete Ledger Statement
router.get('/:id', authenticate, (req, res) => {
  try {
    const account = db.prepare(`
      SELECT k.*, b.name as branch_name
      FROM khata_accounts k
      LEFT JOIN branches b ON k.branch_id = b.id
      WHERE k.id = ?
    `).get(req.params.id);

    if (!account) {
      return res.status(404).json({ error: 'Khata account not found.' });
    }

    const entries = db.prepare(`
      SELECT
        ke.*,
        u.name as user_name,
        b.name as branch_name
      FROM khata_entries ke
      LEFT JOIN users u ON ke.user_id = u.id
      LEFT JOIN branches b ON ke.branch_id = b.id
      WHERE ke.account_id = ?
      ORDER BY ke.entry_date DESC, ke.id DESC
    `).all(account.id);

    res.json({ account, entries });
  } catch (err) {
    console.error('Error fetching khata account details:', err);
    res.status(500).json({ error: 'Failed to load account details.' });
  }
});

// 3. Create New Khata Account
router.post('/', authenticate, (req, res) => {
  try {
    const { name, phone, type = 'payable', opening_balance = 0, notes, branch_id } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Account or person name is required.' });
    }

    const validTypes = ['payable', 'receivable'];
    const accType = validTypes.includes(type) ? type : 'payable';
    const openBal = Math.max(0, Number(opening_balance) || 0);
    const branchId = branch_id ? Number(branch_id) : (req.user?.branch_id || null);

    const result = db.prepare(`
      INSERT INTO khata_accounts (
        name, phone, type, opening_balance, current_balance,
        total_paid, total_received, notes, status, branch_id
      )
      VALUES (?, ?, ?, ?, ?, 0, 0, ?, 'active', ?)
    `).run(
      name.trim(),
      phone ? phone.trim() : null,
      accType,
      openBal,
      openBal,
      notes ? notes.trim() : null,
      branchId
    );

    const accountId = Number(result.lastInsertRowid);

    // If opening balance > 0, insert an opening ledger entry
    if (openBal > 0) {
      db.prepare(`
        INSERT INTO khata_entries (
          account_id, entry_type, amount, payment_method, notes, balance_after, entry_date, user_id, branch_id
        )
        VALUES (?, 'opening', ?, 'initial', ?, ?, date('now'), ?, ?)
      `).run(
        accountId,
        openBal,
        accType === 'payable' ? 'ابتدائی واجب الادا رقم (پیسے دینے ہیں)' : 'ابتدائی واجب الوصول رقم (پیسے لینے ہیں)',
        openBal,
        req.user?.id || null,
        branchId
      );
    }

    logAudit(req.user?.id, 'CREATE_KHATA', 'khata_accounts', accountId, {
      name,
      type: accType,
      opening_balance: openBal
    });

    const created = db.prepare('SELECT * FROM khata_accounts WHERE id = ?').get(accountId);
    res.status(201).json({ message: 'Khata account created successfully.', account: created });
  } catch (err) {
    console.error('Error creating khata account:', err);
    res.status(500).json({ error: 'Failed to create khata account.' });
  }
});

// 4. Update Khata Account info
router.put('/:id', authenticate, (req, res) => {
  try {
    const { name, phone, notes, status } = req.body;
    const account = db.prepare('SELECT * FROM khata_accounts WHERE id = ?').get(req.params.id);

    if (!account) {
      return res.status(404).json({ error: 'Khata account not found.' });
    }

    db.prepare(`
      UPDATE khata_accounts
      SET name = COALESCE(?, name),
          phone = ?,
          notes = ?,
          status = COALESCE(?, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name ? name.trim() : account.name,
      phone !== undefined ? (phone ? phone.trim() : null) : account.phone,
      notes !== undefined ? (notes ? notes.trim() : null) : account.notes,
      status || account.status,
      account.id
    );

    const updated = db.prepare('SELECT * FROM khata_accounts WHERE id = ?').get(account.id);
    res.json({ message: 'Khata account updated.', account: updated });
  } catch (err) {
    console.error('Error updating khata account:', err);
    res.status(500).json({ error: 'Failed to update khata account.' });
  }
});

// 5. Delete Khata Account
router.delete('/:id', authenticate, (req, res) => {
  try {
    const account = db.prepare('SELECT * FROM khata_accounts WHERE id = ?').get(req.params.id);
    if (!account) {
      return res.status(404).json({ error: 'Khata account not found.' });
    }

    db.prepare('DELETE FROM khata_entries WHERE account_id = ?').run(account.id);
    db.prepare('DELETE FROM khata_accounts WHERE id = ?').run(account.id);

    logAudit(req.user?.id, 'DELETE_KHATA', 'khata_accounts', account.id, { name: account.name });
    res.json({ message: 'Khata account and all its entries deleted successfully.' });
  } catch (err) {
    console.error('Error deleting khata account:', err);
    res.status(500).json({ error: 'Failed to delete khata account.' });
  }
});

// 6. Record New Payment / Transaction / Installment for an Account
router.post('/:id/entries', authenticate, (req, res) => {
  try {
    const { entry_type = 'payment', amount, payment_method = 'cash', reference_no, notes, entry_date } = req.body;

    const account = db.prepare('SELECT * FROM khata_accounts WHERE id = ?').get(req.params.id);
    if (!account) {
      return res.status(404).json({ error: 'Khata account not found.' });
    }

    const payAmount = Number(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required.' });
    }

    let newBalance = account.current_balance;
    let newTotalPaid = account.total_paid;
    let newTotalReceived = account.total_received;

    if (account.type === 'payable') {
      // پیسے دینے ہیں
      if (entry_type === 'payment') {
        // ہم نے ادائیگی کی (قسط دی - reduces payable debt)
        newBalance = Math.max(0, account.current_balance - payAmount);
        newTotalPaid += payAmount;
      } else if (entry_type === 'addition') {
        // مزید رقم لی (قرضہ بڑھا - increases payable debt)
        newBalance = account.current_balance + payAmount;
      }
    } else {
      // پیسے لینے ہیں
      if (entry_type === 'payment') {
        // انہوں نے رقم ادا کی (وصولی ہوئی - reduces receivable)
        newBalance = Math.max(0, account.current_balance - payAmount);
        newTotalReceived += payAmount;
      } else if (entry_type === 'addition') {
        // مزید ادھار دیا (increases receivable)
        newBalance = account.current_balance + payAmount;
      }
    }

    const newStatus = newBalance <= 0 ? 'settled' : 'active';
    const dateToRecord = entry_date ? entry_date : new Date().toISOString().split('T')[0];
    const branchId = account.branch_id || req.user?.branch_id || null;

    // Insert Entry
    const insertRes = db.prepare(`
      INSERT INTO khata_entries (
        account_id, entry_type, amount, payment_method, reference_no, notes, balance_after, entry_date, user_id, branch_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      account.id,
      entry_type,
      payAmount,
      payment_method,
      reference_no ? reference_no.trim() : null,
      notes ? notes.trim() : null,
      newBalance,
      dateToRecord,
      req.user?.id || null,
      branchId
    );

    // Update Account
    db.prepare(`
      UPDATE khata_accounts
      SET current_balance = ?,
          total_paid = ?,
          total_received = ?,
          status = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      newBalance,
      newTotalPaid,
      newTotalReceived,
      newStatus,
      account.id
    );

    const updatedAccount = db.prepare('SELECT * FROM khata_accounts WHERE id = ?').get(account.id);
    const recordedEntry = db.prepare('SELECT * FROM khata_entries WHERE id = ?').get(Number(insertRes.lastInsertRowid));

    res.status(201).json({
      message: 'Entry recorded successfully.',
      account: updatedAccount,
      entry: recordedEntry
    });
  } catch (err) {
    console.error('Error recording khata entry:', err);
    res.status(500).json({ error: 'Failed to record entry.' });
  }
});

// 7. Delete an Entry and Recalculate Account Balance
router.delete('/:id/entries/:entryId', authenticate, (req, res) => {
  try {
    const account = db.prepare('SELECT * FROM khata_accounts WHERE id = ?').get(req.params.id);
    if (!account) {
      return res.status(404).json({ error: 'Khata account not found.' });
    }

    const entry = db.prepare('SELECT * FROM khata_entries WHERE id = ? AND account_id = ?').get(req.params.entryId, account.id);
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found.' });
    }

    // Delete the entry
    db.prepare('DELETE FROM khata_entries WHERE id = ?').run(entry.id);

    // Recalculate account balance from all remaining entries
    const remainingEntries = db.prepare(`
      SELECT * FROM khata_entries WHERE account_id = ? ORDER BY entry_date ASC, id ASC
    `).all(account.id);

    let runningBalance = account.opening_balance;
    let totalPaid = 0;
    let totalReceived = 0;

    for (const e of remainingEntries) {
      if (e.entry_type === 'opening') {
        runningBalance = e.amount;
        continue;
      }

      if (account.type === 'payable') {
        if (e.entry_type === 'payment') {
          runningBalance = Math.max(0, runningBalance - e.amount);
          totalPaid += e.amount;
        } else if (e.entry_type === 'addition') {
          runningBalance += e.amount;
        }
      } else {
        if (e.entry_type === 'payment') {
          runningBalance = Math.max(0, runningBalance - e.amount);
          totalReceived += e.amount;
        } else if (e.entry_type === 'addition') {
          runningBalance += e.amount;
        }
      }

      // Update entry's balance_after for clean chronological statement
      db.prepare('UPDATE khata_entries SET balance_after = ? WHERE id = ?').run(runningBalance, e.id);
    }

    const newStatus = runningBalance <= 0 ? 'settled' : 'active';
    db.prepare(`
      UPDATE khata_accounts
      SET current_balance = ?,
          total_paid = ?,
          total_received = ?,
          status = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(runningBalance, totalPaid, totalReceived, newStatus, account.id);

    const updatedAccount = db.prepare('SELECT * FROM khata_accounts WHERE id = ?').get(account.id);
    res.json({ message: 'Entry deleted and balance recalculated.', account: updatedAccount });
  } catch (err) {
    console.error('Error deleting khata entry:', err);
    res.status(500).json({ error: 'Failed to delete entry.' });
  }
});

export default router;
