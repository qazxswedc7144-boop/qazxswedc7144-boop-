import React, { ErrorInfo, ReactNode } from 'react';
import { Card, Button } from './SharedUI';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary - Catch-all for React runtime errors.
 */
// Fix: Explicitly extending React.Component to ensure props and setState are inherited correctly in the type system
class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  constructor(props: Props) {
    super(props);
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Critical System Error:", error, errorInfo);
    // Fix: Accessing setState member of React Component instance using any casting to resolve Property does not exist error (Error line 36)
    (this as any).setState({ errorInfo });
    
    try {
      localStorage.setItem('last_critical_error', JSON.stringify({
        message: error.message,
        time: new Date().toISOString()
      }));
    } catch (e) {}
  }

  private handleSafeRestart = () => {
    try {
      sessionStorage.clear();
    } catch (e) {}
    window.location.reload();
  };

  public render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    
    if (hasError) {
      return (
        <div className="min-h-screen bg-[#F0F7F7] flex items-center justify-center p-4 sm:p-6 text-right font-cairo" dir="rtl">
          <Card className="max-w-lg w-full p-8 sm:p-12 space-y-8 animate-in zoom-in duration-500 shadow-2xl border-4 border-white !rounded-[48px]">
            <div className="text-center space-y-4">
              <div className="w-24 h-24 bg-red-50 text-red-500 rounded-[32px] flex items-center justify-center text-5xl mx-auto shadow-inner animate-pulse">⚠️</div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#1E4D4D]">توقف النظام مؤقتاً</h1>
              <p className="text-slate-500 font-bold text-sm leading-relaxed">
                واجه المحرك المالي مشكلة غير متوقعة. لا تقلق، بياناتك الأساسية في أمان داخل قاعدة البيانات المشفرة.
              </p>
            </div>

            <div className="bg-slate-50 rounded-[24px] p-5 border border-slate-100">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">تفاصيل الخطأ التقني:</p>
               <div className="max-h-32 overflow-y-auto custom-scrollbar font-mono text-[10px] text-red-400 leading-tight" dir="ltr">
                  {error?.toString()}
                  <br />
                  {errorInfo?.componentStack?.slice(0, 300)}...
               </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button 
                variant="primary" 
                className="w-full h-16 !rounded-[24px] text-base shadow-xl"
                onClick={this.handleSafeRestart}
                icon="🔄"
              >
                إعادة تشغيل النظام بأمان
              </Button>
              <button 
                onClick={() => window.location.href = '/'}
                className="text-[11px] font-black text-slate-400 hover:text-[#1E4D4D] transition-colors"
              >
                العودة للشاشة الرئيسية
              </button>
            </div>

            <div className="pt-4 border-t border-slate-50 flex items-center justify-center gap-2">
               <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
               <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">PharmaFlow Auto-Recovery Active</span>
            </div>
          </Card>
        </div>
      );
    }

    // Fix: Accessing props.children using any casting to resolve Property does not exist error (Error line 104)
    return (this as any).props.children;
  }
}

export default ErrorBoundary;
