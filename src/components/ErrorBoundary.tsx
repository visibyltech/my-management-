import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
  details: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
    details: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    let message = error.message || 'An unexpected application error occurred.';
    let details: string | null = null;

    try {
      const parsed = JSON.parse(error.message) as {
        error?: string;
        operationType?: string;
        path?: string;
      };
      if (parsed && parsed.error) {
        message = parsed.error;
        details = `Operation: ${parsed.operationType || 'unknown'} · Path: ${parsed.path || 'unknown'}`;
      }
    } catch {
      // Standard error string
    }

    return { hasError: true, errorMessage: message, details };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Something needs attention</h1>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">{this.state.errorMessage}</p>
            {this.state.details && (
              <p className="mt-3 text-xs font-mono-tabular text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                {this.state.details}
              </p>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-6 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#0144D8] text-white text-sm font-semibold hover:bg-[#0133A6] transition-colors whitespace-nowrap"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
