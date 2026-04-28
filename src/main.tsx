import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppProvider } from './store/AppContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import { blockDirectDB, blockDexieErrors } from './core/guard';
import './core/debug';

blockDirectDB();
blockDexieErrors();

window.addEventListener("error", (e) => {
  console.error("GLOBAL ERROR:", e.message);
  console.error("🔥 ERROR LOCATION:", { msg: e.message, src: e.filename, line: e.lineno, col: e.colno });
  if (e.message.includes("ممنوع")) {
    console.error("🚨 DIRECT DB VIOLATION");
  }
});

/* 
if (process.env.NODE_ENV === 'production') {
  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};
}
*/

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element");

const root = createRoot(rootElement);
root.render(
    <ErrorBoundary>
      <AppProvider>
        <App />
      </AppProvider>
    </ErrorBoundary>
);