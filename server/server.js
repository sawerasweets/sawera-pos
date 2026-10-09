import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

import { initDatabase } from './db.js';
import authRoutes from './routes/auth.js';
import branchRoutes from './routes/branches.js';
import categoryRoutes from './routes/categories.js';
import productRoutes from './routes/products.js';
import posRoutes from './routes/pos.js';
import salesRoutes from './routes/sales.js';
import inventoryRoutes from './routes/inventory.js';
import purchaseRoutes from './routes/purchases.js';
import customerRoutes from './routes/customers.js';
import supplierRoutes from './routes/suppliers.js';
import expenseRoutes from './routes/expenses.js';
import cashRegisterRoutes from './routes/cashRegister.js';
import reportRoutes from './routes/reports.js';
import userRoutes from './routes/users.js';
import settingRoutes from './routes/settings.js';
import backupRoutes from './routes/backup.js';
import auditRoutes from './routes/audit.js';
import recipeRoutes from './routes/recipes.js';
import wasteRoutes from './routes/waste.js';
import stockAuditRoutes from './routes/stockAudit.js';
import quotationRoutes from './routes/quotations.js';
import promotionRoutes from './routes/promotions.js';
import { initTursoSync, triggerCloudSync, flushCloudSyncNow } from './tursoSync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB schema & demo records
initDatabase();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Auto-sync mutations to Turso Cloud (debounced after any successful API write)
app.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method) && req.path.startsWith('/api/')) {
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        triggerCloudSync();
      }
    });
  }
  next();
});

// Static uploads directory
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/cash-register', cashRegisterRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/waste', wasteRoutes);
app.use('/api/stock-audit', stockAuditRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/promotions', promotionRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'Sawera Sweet & Bakers POS',
    time: new Date().toISOString()
  });
});

// Serve frontend in production
const DIST_DIR = path.join(__dirname, '..', 'dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      return res.sendFile(path.join(DIST_DIR, 'index.html'));
    }
    next();
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

async function startServer() {
  // Initialize Turso Cloud Sync (automatically pulls latest cloud state on container boot)
  await initTursoSync();

  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`  SAWERA SWEET & BAKERS - POS & SHOP MANAGEMENT`);
    console.log(`  Server running on http://localhost:${PORT}`);
    console.log(`  Cloud Database Sync: ACTIVE (Turso Lifetime Storage)`);
    console.log(`====================================================`);
  });
}

startServer();

// Graceful shutdown flush
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, flushing final state to Turso Cloud...');
  await flushCloudSyncNow();
  process.exit(0);
});
process.on('SIGINT', async () => {
  console.log('Received SIGINT, flushing final state to Turso Cloud...');
  await flushCloudSyncNow();
  process.exit(0);
});
