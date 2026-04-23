const fs = require('fs');
const path = require('path');

const currentDir = process.cwd();

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

const allFiles = walkSync('./');
const tsFiles = allFiles.filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));

const newPaths = {};

const pagesList = [
    'Dashboard.tsx', 'FinancialDashboard.tsx', 'AccountManagement.tsx', 
    'AdjustmentForm.tsx', 'PurchasesInvoice.tsx'
];

function isPage(fileName) {
   if (pagesList.includes(fileName)) return true;
   if (fileName.endsWith('Module.tsx')) return true;
   if (fileName.endsWith('Report.tsx')) return true;
   return false;
}

// Map intended moves
tsFiles.forEach(file => {
   const relPath = './' + path.relative(currentDir, file).replace(/\\/g, '/');
   let dest = relPath;
   const baseName = path.basename(relPath);

   if (relPath.startsWith('./components/')) {
       if (isPage(baseName)) {
           dest = './src/pages/' + baseName;
       } else {
           dest = './src/components/' + baseName;
       }
   } else if (relPath.startsWith('./services/')) {
       if (['supabaseClient.ts', 'database.ts', 'hash.ts'].includes(baseName)) {
           dest = './src/lib/' + baseName;
       } else {
           dest = './src/services/' + baseName;
       }
   } else if (relPath === './types.ts') {
       dest = './src/types/index.ts';
   } else if (
       relPath.startsWith('./store/') || 
       relPath.startsWith('./utils/') || 
       relPath.startsWith('./repositories/') || 
       relPath.startsWith('./core/') ||
       relPath.startsWith('./hooks/')
   ) {
       dest = './src/' + relPath.replace('./', '');
   }
   
   if (dest !== relPath) {
      newPaths[relPath] = dest;
   }
});

// Find old path keys ignoring extension
function getMappedDest(searchPath) {
    for (let ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
        if (newPaths[searchPath + ext]) {
            return newPaths[searchPath + ext];
        } else {
            // Also check if the searchPath already matches an original file that wasn't moved.
            if (fs.existsSync(searchPath + ext) && Object.keys(newPaths).includes(searchPath + ext) === false) {
                return searchPath + ext;
            }
        }
    }
    return null;
}

function updateImports(content, oldFilePath) {
   const importExportRegex = /(import|export)\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
   const lazyRegex = /(await import\()(['"]([^'"]+)['"])\)/g;

   // Handle standard imports
   let updated = content.replace(importExportRegex, (match, type, names, importPath) => {
      let resolvedDepPath;
      if (importPath.startsWith('.')) {
         resolvedDepPath = path.resolve(path.dirname(oldFilePath), importPath);
         resolvedDepPath = './' + path.relative(currentDir, resolvedDepPath).replace(/\\/g, '/');
      } else if (importPath.startsWith('@/')) {
         resolvedDepPath = './' + importPath.substring(2);
      } else {
         return match; // external
      }

      let destFile = getMappedDest(resolvedDepPath);
      
      if (destFile) {
          // Both the importer and importee's final locations
          let myDest = newPaths[oldFilePath] || oldFilePath;
          let targetDest = destFile;
          
          let newImportPath = path.relative(path.dirname(myDest), targetDest).replace(/\\/g, '/');
          if (!newImportPath.startsWith('.')) newImportPath = './' + newImportPath;
          
          // remove extension
          newImportPath = newImportPath.replace(/\.tsx?$/, '').replace(/\/index$/, '');
          return `${type} ${names} from '${newImportPath}'`;
      }
      return match;
   });

   // Handle lazy imports
   updated = updated.replace(lazyRegex, (match, prefix, quotedPath, importPath) => {
       let resolvedDepPath;
       if (importPath.startsWith('.')) {
          resolvedDepPath = path.resolve(path.dirname(oldFilePath), importPath);
          resolvedDepPath = './' + path.relative(currentDir, resolvedDepPath).replace(/\\/g, '/');
       } else if (importPath.startsWith('@/')) {
          resolvedDepPath = './' + importPath.substring(2);
       } else {
          return match;
       }

       let destFile = getMappedDest(resolvedDepPath);
       if (destFile) {
           let myDest = newPaths[oldFilePath] || oldFilePath;
           let targetDest = destFile;
           let newImportPath = path.relative(path.dirname(myDest), targetDest).replace(/\\/g, '/');
           if (!newImportPath.startsWith('.')) newImportPath = './' + newImportPath;
           newImportPath = newImportPath.replace(/\.tsx?$/, '').replace(/\/index$/, '');
           return `${prefix}'${newImportPath}')`;
       }
       return match;
   });

   return updated;
}

const memoryFiles = {};
tsFiles.forEach(file => {
   const relPath = './' + path.relative(currentDir, file).replace(/\\/g, '/');
   memoryFiles[relPath] = fs.readFileSync(file, 'utf-8');
});

Object.keys(memoryFiles).forEach(oldPath => {
    memoryFiles[oldPath] = updateImports(memoryFiles[oldPath], oldPath);
});

// App.tsx special case
if (memoryFiles['./App.tsx']) {
    newPaths['./App.tsx'] = './src/App.tsx';
}

Object.keys(newPaths).forEach(oldPath => {
    const dest = newPaths[oldPath];
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    // avoid renaming across limits, copy and delete
    try {
      fs.copyFileSync(oldPath, dest);
      fs.unlinkSync(oldPath);
    } catch(e) {}
});

Object.keys(memoryFiles).forEach(oldPath => {
    const dest = newPaths[oldPath] || oldPath;
    fs.writeFileSync(dest, memoryFiles[oldPath], 'utf-8');
});

console.log("Refactoring complete");
