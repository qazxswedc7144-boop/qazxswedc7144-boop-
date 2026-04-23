const fs = require('fs');
const path = require('path');

function walkSync(dir, filelist = []) {
  if (dir.includes('node_modules') || dir.includes('.git') || dir.includes('dist')) return filelist;
  fs.readdirSync(dir).forEach(file => {
    let filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      filelist = walkSync(filePath, filelist);
    } else {
      filelist.push(filePath);
    }
  });
  return filelist;
}

const files = walkSync('./src');

files.forEach(file => {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) return;
    
    let content = fs.readFileSync(file, 'utf-8');
    let original = content;

    // 1. Fix ./src/ over-nesting (since we are already in src now)
    // Only in root of src (like App.tsx, main.tsx)
    if (path.dirname(file) === 'src') {
        content = content.replace(/from ['"]\.\/src\//g, "from './");
        content = content.replace(/import\(['"]\.\/src\//g, "import('./");
    }

    // 2. Fix lazy imports in App.tsx (they didn't have wait, so they were missed)
    if (file === 'src/App.tsx' || file.includes('App.tsx')) {
        // App.tsx is in src/, so importing pages should be './pages/Dashboard'
        const pages = ['Dashboard', 'FinancialDashboard', 'PurchasesInvoice', 'SalesModule', 'InventoryModule', 'InventoryAuditModule', 'SettingsModule', 'AccountingModule', 'ReconciliationModule', 'SystemHealthModule', 'InvoicesArchiveModule', 'InvoiceHistoryModule', 'AdjustmentsArchiveModule', 'SupplierPaymentModule', 'CustomerReceiptModule', 'VouchersModule', 'AgingReportModule', 'ReportsModule', 'AdvancedReportsModule'];
        
        pages.forEach(p => {
             content = content.replace(`import('./components/${p}')`, `import('./pages/${p}')`);
             content = content.replace(`import('./components/reports/${p}')`, `import('./pages/reports/${p}')`);
        });
        
        // Also fix the lazy reports that might have moved to pages
        const reports = ['RemainingStockReport', 'ItemProfitsReport', 'CustomerProfitReport', 'SupplierProfitReport', 'AccountMovementReport', 'PurchasesByItemReport', 'SalesByItemReport', 'ItemMovementDetailsReport', 'ExpiryItemsReport'];
        reports.forEach(r => {
             content = content.replace(`import('./components/reports/${r}')`, `import('./pages/reports/${r}')`);
             content = content.replace(`import('./components/${r}')`, `import('./pages/${r}')`);
        });

        // Some specific fixes
        content = content.replace(/from '\.\/components\/Dashboard'/g, "from './pages/Dashboard'");
        content = content.replace(/import\('\.\/services\//g, "import('./services/");
    }

    // 3. Fix ../../constants to ../constants.tsx
    // Since we moved constants.tsx to src/constants.tsx, inside src/components/ SharedUI it should be '../constants'
    content = content.replace(/['"]\.\.\/\.\.\/constants['"]/g, "'../constants'");

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf-8');
    }
});
console.log('Fixed specific import paths');
