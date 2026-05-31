import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasFault: boolean;
  fault: Error | null;
  faultInfo: ErrorInfo | null;
}

/**
 * Enterprise app-level safe recovery Fault Boundary.
 */
export class AppFaultBoundary extends Component<Props, State> {
  public state: State = {
    hasFault: false,
    fault: null,
    faultInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasFault: true, fault: error, faultInfo: null };
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
    const { hasFault, fault, faultInfo } = this.state;
    
    if (hasFault) {
      return (
        <div className="min-h-screen bg-[#F8FAFA] flex items-center justify-center p-6 text-right" dir="rtl">
          <div className="bg-white p-8 sm:p-12 rounded-[32px] shadow-2xl border-4 border-red-50 max-w-lg w-full text-center space-y-6">
            <div className="w-24 h-24 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-4xl mx-auto shadow-inner animate-pulse">
              ⚠️
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-black text-[#1E4D4D]">حدث خطأ في واجهة العرض</h1>
              <p className="text-slate-500 text-sm leading-relaxed">
                تم عزل الخطأ التقني بنجاح لتجنب فقدان البيانات أو انهيار النظام المالي.
              </p>
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
