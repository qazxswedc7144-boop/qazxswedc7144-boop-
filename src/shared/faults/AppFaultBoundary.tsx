import { Component, ErrorInfo, ReactNode } from 'react';
import { useAuthStore } from '../../store/authStore';
import { db } from '../../core/db';

interface Props {
  children: ReactNode;
}

interface State {
  hasFault: boolean;
  fault: Error | null;
  faultInfo: ErrorInfo | null;
  syncStatus: 'idle' | 'sending' | 'success' | 'offline_saved' | 'failed';
}

/**
 * Enterprise app-level safe recovery Fault Boundary.
 */
export class AppFaultBoundary extends Component<Props, State> {
  public state: State = {
    hasFault: false,
    fault: null,
    faultInfo: null,
    syncStatus: 'idle'
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasFault: true, fault: error, faultInfo: null, syncStatus: 'idle' };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn("💥 [CRITICAL RENDER EXCEPTION]:", error);
    console.warn("📍 Stack trace location:", errorInfo.componentStack);
    
    // Attempt local storage log for subsequent diagnosis calls
    try {
      localStorage.setItem('pf_last_render_crash', JSON.stringify({
        message: error.message,
        stack: errorInfo.componentStack,
        timestamp: new Date().toISOString()
      }));
    } catch (e) {}

    const userState = useAuthStore.getState();
    const user = userState.user;
    
    const payload = {
      tenantId: user?.tenantId || "SYSTEM_TENANT",
      branchId: user?.branchId || "SYSTEM_BRANCH",
      userId: user?.id || "anonymous",
      route: window.location.hash || window.location.pathname || "/",
      deviceFingerprint: navigator.userAgent || "Unknown Device",
      appVersion: "1.0.0",
      stackTrace: errorInfo.componentStack || error.stack || "",
      errorMessage: error.message || String(error),
      timestamp: Date.now()
    };

    // Check online status
    if (!navigator.onLine) {
      console.warn("🌐 [OFFLINE] Device is offline. Bypassing live crash telemetry and logging directly to local IndexedDB...");
      this.setState({ syncStatus: 'sending' });
      
      try {
        db.System_Error_Log.add({
          id: `CRASH-${Date.now()}`,
          Error_ID: `CRASH-${Date.now()}`,
          Module_Name: "CLIENT_CRASH",
          errorMessage: payload.errorMessage,
          stackTrace: payload.stackTrace,
          route: payload.route,
          timestamp: payload.timestamp,
          isPendingSync: true
        }).then(() => {
          console.log("💾 [OFFLINE_STORAGE] Crash written successfully to offline Dexie store.");
          this.setState({ syncStatus: 'offline_saved' });
        }).catch((err: any) => {
          console.error("✖ Dexie add error:", err);
          this.setState({ syncStatus: 'failed' });
        });
      } catch (e) {
        this.setState({ syncStatus: 'failed' });
      }
    } else {
      // Device is online! Post telemetry to server and push to Capacitor Crashlytics if available
      this.setState({ syncStatus: 'sending' });

      // Live Capacitor Plugin integration hook
      try {
        const Capacitor = (window as any).Capacitor;
        if (Capacitor && Capacitor.Plugins && Capacitor.Plugins.FirebaseCrashlytics) {
          Capacitor.Plugins.FirebaseCrashlytics.log({ message: `Crash: ${payload.errorMessage}` });
          Capacitor.Plugins.FirebaseCrashlytics.recordException({
            message: payload.errorMessage,
            stackTrace: payload.stackTrace
          }).then(() => {
            console.log("🚀 [Capacitor Firebase Crashlytics] Dispatched crash package successfully.");
          }).catch((err: any) => {
            console.warn("[Capacitor Firebase Crashlytics] Handshake failed:", err);
          });
        }
      } catch (capErr) {
        console.warn("[CAPACITOR] Crashlytics call error:", capErr);
      }

      // Live fetch post to API routes
      fetch('/api/security/crash', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }).then(response => {
        if (!response.ok) {
          console.warn("[CRASH_LOGGER] Failed to dispatch remote crash log:", response.statusText);
          this.setState({ syncStatus: 'failed' });
        } else {
          console.log("🚀 [CRASH_LOGGER] Remote crash trace successfully reported to secure server log.");
          this.setState({ syncStatus: 'success' });
        }
      }).catch(err => {
        console.warn("[CRASH_LOGGER] Network connection failure to crash logging api:", err.message);
        // Fallback to local Dexie on fetch network failure
        try {
          db.System_Error_Log.add({
            id: `CRASH-${Date.now()}`,
            Error_ID: `CRASH-${Date.now()}`,
            Module_Name: "CLIENT_CRASH",
            errorMessage: payload.errorMessage,
            stackTrace: payload.stackTrace,
            route: payload.route,
            timestamp: payload.timestamp,
            isPendingSync: true
          }).then(() => {
            this.setState({ syncStatus: 'offline_saved' });
          });
        } catch (dexIE) {
          this.setState({ syncStatus: 'failed' });
        }
      });
    }
    
    this.setState({ faultInfo: errorInfo });
  }

  private handleFullReset = () => {
    try {
      // Clear storage elements and force a hard refresh
      const isDev = window.location.hostname === 'localhost' || 
                    window.location.hostname.includes('127.0.0.1') || 
                    window.location.hostname.includes('ais-dev');
      
      if (isDev) {
        sessionStorage.clear();
        console.log('[RECOVERY] Session storage cleared.');
      }
    } catch (e) {}
    window.location.hash = '#/dashboard';
    window.location.reload();
  };

  public render(): ReactNode {
    const { hasFault, fault, faultInfo, syncStatus } = this.state;
    
    if (hasFault) {
      return (
        <div className="min-h-screen bg-[#F8FAFA] flex items-center justify-center p-6 text-right" dir="rtl">
          <div className="bg-white p-8 sm:p-12 rounded-[32px] shadow-2xl border-4 border-red-50 max-w-lg w-full text-center space-y-6">
            <div className="w-24 h-24 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-4xl mx-auto shadow-inner animate-pulse">
              ⚠️
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-black text-[#1E4D4D]">نعتذر، حدث خطأ غير متوقع</h1>
              <p className="text-slate-500 text-sm leading-relaxed">
                جاري إرسال تقرير الدعم الفني بشكل تلقائي وآمن وتأمين عملياتك محلياً.
              </p>
            </div>

            {/* Sync status loader indicator */}
            <div className="bg-[#EEF2F6] rounded-2xl p-4 flex items-center justify-center gap-3 text-xs font-bold text-[#1E4D4D]">
              {syncStatus === 'sending' && (
                <>
                  <div className="w-4 h-4 border-2 border-[#1E4D4D] border-t-transparent rounded-full animate-spin"></div>
                  <span>جاري إرسال تقرير التشخيص فوريًا ومزامنة الخطأ...</span>
                </>
              )}
              {syncStatus === 'success' && (
                <>
                  <span className="text-emerald-600">✔</span>
                  <span className="text-emerald-800">تم إرسال تقرير الأعطال للدعم السحابي بنجاح.</span>
                </>
              )}
              {syncStatus === 'offline_saved' && (
                <>
                  <span className="text-amber-600">💾</span>
                  <span className="text-amber-800">الجهاز أوفلاين. تم حفظ حزمة الأعطال محلياً بمخزن المزامنة الآمن.</span>
                </>
              )}
              {syncStatus === 'failed' && (
                <>
                  <span className="text-red-500">⚠</span>
                  <span className="text-red-700">تعذر الوصول لمركز الاتصال السحابي. تم تأمين النظام محليًا.</span>
                </>
              )}
            </div>

            <div className="bg-slate-50 rounded-[20px] p-4 text-left border border-slate-100 font-mono text-[11px] text-red-500 max-h-40 overflow-y-auto custom-scrollbar" dir="ltr">
              <p className="font-bold underline mb-1">Issue Message:</p>
              <p className="mb-2">{fault?.message || String(fault)}</p>
              {faultInfo && (
                <>
                  <p className="font-bold underline mb-1">Component Stack:</p>
                  <pre className="whitespace-pre-wrap leading-tight">{faultInfo.componentStack?.slice(0, 500)}</pre>
                </>
              )}
            </div>

            <div className="space-y-3 pt-2">
              <button 
                onClick={this.handleFullReset}
                className="w-full h-14 bg-[#1E4D4D] text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-[#153a3a] active:scale-95 transition-all shadow-lg"
              >
                🔄
                <span>إعادة إقلاع النظام وتأهيل المحرك</span>
              </button>
              
              <button 
                onClick={() => {
                  window.location.hash = '#/dashboard';
                  window.location.reload();
                }}
                className="w-full h-12 bg-white border border-slate-200 text-slate-500 rounded-2xl font-black text-xs hover:bg-slate-50 active:scale-95 transition-all"
              >
                العودة إلى لوحة القيادة
              </button>
            </div>

            <div className="pt-4 border-t border-slate-50 flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              <span className="text-[10px] font-black text-slate-400 tracking-wider">PharmaFlow Core Resilience Active</span>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AppFaultBoundary;
