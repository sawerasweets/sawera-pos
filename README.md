# 🍬 Sawera Sweet & Bakers - POS & Shop Management System
### سویرا سویٹس اینڈ بیکرز - پوائنٹ آف سیل و شاپ مینجمنٹ سافٹ ویئر

A professional, production-ready Point of Sale (POS) and Multi-Branch Shop Management Software engineered specifically for Pakistani retail confectionery, bakery, cosmetics, cold drinks, and grocery businesses.

---

## 🌟 Key System Capabilities

### 1. Multi-Branch Architecture
- **4 Active Branches Configured Out-of-the-Box**:
  - `BR-01`: Main Saddar Branch, Rawalpindi
  - `BR-02`: Gulberg Branch, Lahore
  - `BR-03`: DHA Phase 5 Branch, Lahore
  - `BR-04`: Township / Ferozepur Road Branch, Lahore
- **Scalable**: Easily add Branch 5, Branch 6, etc. with individual contact numbers, managers, operating hours, and inventory.
- **Admin Switcher**: Admin can view consolidated data across all 4 branches or filter down to a specific branch.

### 2. High-Speed Retail POS Billing
- **Lightning-Fast Product Lookup**: Real-time search by Product Name (English & Urdu), Barcode, or SKU.
- **USB Barcode Scanner Support**: Automatically detects barcode scanner input and adds the item to the cart instantly.
- **Visual Category Filter Badges**: Sweets, Bakery, Cakes, Biscuits, Cold Drinks, Cosmetics, Perfumes, Shampoo, Face Wash & Soaps, Grocery & Dairy.
- **Cart Management**: Quantity increment/decrement, direct numeric entry, item-level discounts, line totals, and overall bill discount (PKR or %).
- **Parked / Held Bills (F4)**: Park customer bills while they fetch cash or additional items; recall held bills instantly.
- **Keyboard Ergonomics**:
  - `F1`: New Sale / Clear Cart
  - `F2`: Focus Search / Barcode Input
  - `F3`: Select Customer
  - `F4`: Hold / Park Current Bill
  - `F5`: Open Payment & Checkout Modal
  - `F6`: Print Receipt
  - `Esc`: Cancel / Close Dialog

### 3. Payment Methods & Split Tender
- **Cash**: Enter tendered cash, auto-calculates Change Return.
- **Split Payments**: E.g., Bill of Rs. 2,000 paid as Rs. 1,000 Cash + Rs. 1,000 Easypaisa.
- **Easypaisa & JazzCash**
- **Bank Debit/Credit Card & Bank Transfer**
- **Credit / Udhaar (ادھار کھاتہ)**: Link to customer account, verifies credit limit, automatically updates outstanding ledger balance.

### 4. Professional Invoice & Thermal Receipt Printing
- **80mm & 58mm Thermal Printer Layout**: Compatible with standard retail receipt printers (EPSON, Xprinter, Rongta, Bixolon, Black Copper, Sunmi).
- **A4 Standard Tax Invoice**: Formatted invoice layout for bulk or corporate orders.
- **Receipt Details**: Business name, branch name, address, phone, NTN, cashier name, itemized table, payment method breakdown, customer Udhaar balance, barcode, and Urdu footer *"آپ کی تشریف آوری کا بہت شکریہ"*.

### 5. Product Management & Barcode Label Printing
- **Comprehensive Fields**: English name, Urdu name, Code, SKU, Barcode, Category, Brand, Purchase Price (Cost), Sale Price (Retail), Wholesale Price, Unit (Piece, Kg, Gram, Liter, Box, Pack, Dozen, etc.), Supplier, Expiry Date, Image, and Min Stock Alert Threshold.
- **Printable Barcode Stickers**: Built-in barcode label generator that renders and prints sticker sheets with product name, barcode, and PKR price.

### 6. Inventory & Multi-Branch Stock Tracking
- **Stock Valuation**: Real-time inventory valuation at Cost Price and at Retail Sale Price.
- **Stock Movements Ledger**: Complete audit trail for every stock change (Purchase, Sale, Return, Damage, Adjustment, Branch Transfer).
- **Branch-to-Branch Transfers**: Dispatch stock from Branch A to Branch B with tracking and automated ledger updates.
- **Stock Alerts**: Real-time alerts for Low Stock, Out of Stock, and Expiring Soon items.

### 7. Purchases & Supplier Management
- **Inward Orders**: Record purchases from suppliers, select receiving branch, update purchase prices.
- **Automatic Restocking**: Inventory increases automatically on purchase save.
- **Supplier Ledger & Payables**: Track supplier balances and record payment vouchers (Cash, Bank, Cheque).
- **Purchase Returns**: Return damaged/expired stock to vendors with stock reduction and supplier balance credit.

### 8. Customer Management & Udhaar Recovery
- **Customer Profiles**: Name, phone, address, credit limit, and current outstanding Udhaar balance.
- **Receive Payment / Udhaar Recovery Screen**: Record partial or full installment payments against customer credit with payment receipt vouchers.
- **Full Statement**: View past invoice history and recovery payments.

### 9. Daily Expenses Management
- **Categories**: Electricity, Rent, Salaries, Transport, Maintenance, Packaging Boxes, Marketing, Miscellaneous, Other.
- **Drawer Linkage**: Expenses paid via cash drawer automatically deduct from the shift's expected cash.

### 10. Cash Register & Shift Drawer Control
- **Opening Cash Float**: Cashier opens shift with starting float (e.g. Rs. 10,000).
- **Shift Telemetry**: Opening Cash + Cash Sales + Udhaar Cash Received - Cash Refunds - Cash Expenses = Expected Drawer Cash.
- **Closing Shift**: Cashier enters physical cash counted; system calculates shortage or excess variance.

### 11. 19 Comprehensive Financial & Analytical Reports
1. Daily Sales Summary
2. Weekly Sales Overview
3. Monthly Sales Report
4. Custom Date Range Sales
5. Profit & Loss Statement (Gross Sales, COGS, Gross Profit, Expenses, Net Profit, Profit Margin %)
6. Purchase Inwards Report
7. Expense Categories Breakdown
8. Inventory Valuation & Stock Health Report
9. Low Stock Alert Report
10. Out of Stock Critical Report
11. Product Sales Leaderboard (Best Sellers)
12. Customer Sales Volume
13. Credit / Udhaar Aging Report
14. Supplier Accounts Payable Report
15. Sales Returns & Refunds Report
16. Purchase Returns to Vendors Report
17. Cashier Staff Performance
18. Multi-Branch Comparative Audit
19. Payment Mode Breakdown
- **1-Click Export to CSV / Excel** and **Print-Ready formatting**.

### 12. Security, User Roles & Audit Trail
- **Role-Based Access Control (RBAC)**:
  - **Admin / Owner**: Full system control, branch management, profit visibility, settings, backup/restore.
  - **Manager**: Inventory, purchases, expenses, reports, customer/supplier management.
  - **Cashier**: POS billing, customer checkout, permitted returns, cash register (cannot view profit or delete products).
- **Audit Log**: Immutable audit trail of price changes, product additions/deletions, stock adjustments, and sales.

### 13. Backup & Recovery Subsystem
- **One-Click Backup**: Download complete SQLite database state as a portable JSON dump.
- **One-Click Restore**: Restore system state from backup file with confirmation.
- **Re-Seed Demo Data**: Instant restore of realistic Pakistani sample data.

### 14. Dual-Language Support (English & Urdu - اردو)
- Instant top-bar language toggle between English and Urdu.
- Native RTL layout (`dir="rtl"`) with beautiful typography (*Noto Nastaliq Urdu*).
- Bilingual receipts and product names.

---

## 🚀 Getting Started

### Prerequisites
- Node.js v20+ or v24+ (Node v24 includes native `node:sqlite`)
- npm v10+

### Default User Credentials
| Role | Username | Password | Access Scope |
|---|---|---|---|
| **Admin / Owner** | `admin` | `admin123` | All 4 Branches & System Settings |
| **Manager** | `manager1` | `manager123` | Branch 1 Operations & Stock |
| **Cashier - Saddar** | `cashier1` | `cashier123` | Branch 1 POS Billing |
| **Cashier - Gulberg** | `cashier2` | `cashier123` | Branch 2 POS Billing |

### Running the Application

```bash
# Start the production server (serves both API & Frontend on port 5000)
npm start

# Or run client and server in development mode:
npm run dev:server   # Starts Express backend on http://localhost:5000
npm run dev:client   # Starts Vite dev server on http://localhost:3000
```

Open your browser at:
👉 **`http://localhost:5000`**

### Running the Automated E2E Test Suite

```bash
node test_system.js
```
Verifies all 20 business operations including authentication, multi-branch stock reduction, split payments, Udhaar sales, payment collection, sales returns, inward purchases, expenses, and financial reporting.
