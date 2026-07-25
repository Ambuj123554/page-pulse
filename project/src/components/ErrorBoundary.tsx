import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, Bug } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Optional fallback to render instead of the default error UI. */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Caught an error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-5"
        >
          <div className="flex items-start gap-3">
            <div className="text-red-600 mt-0.5">
              <Bug className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                <h3 className="text-sm font-semibold text-red-900">
                  Something went wrong
                </h3>
              </div>
              <p className="text-sm text-red-800">
                A rendering error occurred. Please try auditing a different
                URL or reload the page.
              </p>
              {this.state.error && (
                <pre className="text-xs text-red-600 mt-2 whitespace-pre-wrap font-mono bg-red-100/60 rounded p-2">
                  {this.state.error.message}
                </pre>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
