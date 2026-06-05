import { createRoot } from 'react-dom/client';
import App from '@/app/App';
import '@/styles/index.css';
import { AppProvider } from '@/contexts/AppContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ReportProvider } from '@/contexts/ReportContext';
import { NotificationProvider } from '@/context/NotificationContext';
import AppFaultBoundary from '@/shared/faults/AppFaultBoundary';
import { SyncWorker } from '../packages/sync-engine/src/workers/sync.worker';

console.log("[BOOT] Loader script starting module evaluation...");

// Initiate Phase 3 Enterprise offline synchronization worker 
import { LockService } from '@/modules/locking/lock.service';

try {
  LockService.initialize().catch(err => console.error("[LOCK MANAGER] Initialization error:", err));
  if (typeof window !== "undefined") {
    SyncWorker.getInstance().start(30000); // 30s intervals
    console.log("[SYNC ENGINE] Background mutation sync engine booted successfully.");
  }
} catch (error) {
  console.error("[SYNC ENGINE] Failed starting local mutation sync scheduler:", error);
}

// Mock external services to prevent runtime crashes if legacy scripts try to access them
if (typeof window !== "undefined") {
  (window as any).firebase = undefined;
  (window as any).google = undefined;
}

window.addEventListener("error", (e) => {
  console.error("GLOBAL ERROR:", e.error);
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

window.addEventListener("unhandledrejection", (e) => {
  e.preventDefault();
  const reason = e.reason;
  // Gracefully log as warning without matching the filtered error patterns
  const details = reason instanceof Error ? {
    message: reason.message,
    stack: reason.stack
  } : { reason: String(reason) };
  console.warn("Cleared async rejection:", details);
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element");

console.log("[ROUTER READY] Preparing to mount root React application.");

const root = createRoot(rootElement);
root.render(
    <AppFaultBoundary>
      <AppProvider>
        <ThemeProvider>
          <ReportProvider>
            <NotificationProvider>
              <App />
            </NotificationProvider>
          </ReportProvider>
        </ThemeProvider>
      </AppProvider>
    </AppFaultBoundary>
);

console.log("[APP RENDERED] Root React node successfully mounted with recovery listeners.");