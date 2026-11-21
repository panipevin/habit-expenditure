import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'An unexpected error occurred in the workspace.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('Workspace ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      let friendly = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed && parsed.error && parsed.operationType) {
          friendly = `Cloud sync permission error during ${parsed.operationType} on ${parsed.path || 'workspace'}: ${parsed.error}`;
        }
      } catch {
        // Keep raw error message
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F6F7F9] dark:bg-[#0A0D14] p-6">
          <div className="max-w-md w-full rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-6">
            <div className="flex items-center gap-3 text-[#DC2626] dark:text-[#F87171]">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h2 className="font-display text-lg font-semibold">Workspace Recovery</h2>
            </div>
            <p className="mt-3 text-sm text-[#556075] dark:text-[#94A3B8] leading-relaxed">
              {friendly}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.reload();
              }}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#0E1525] dark:bg-[#F1F5F9] px-4 py-2 text-sm font-medium text-white dark:text-[#0E1525] hover:opacity-90 transition-opacity"
            >
              <RotateCcw className="w-4 h-4" />
              Reload Workspace
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
