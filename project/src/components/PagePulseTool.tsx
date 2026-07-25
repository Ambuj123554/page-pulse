import { useState, FormEvent } from 'react';
import { Activity, Search, Loader2, AlertCircle } from 'lucide-react';
import { ReportCard } from '@/components/ReportCard';
import { ErrorMessage } from '@/components/ErrorMessage';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Footer } from '@/components/Footer';

// In dev mode, Vite proxies /api requests to the Express backend.
// In production, Express serves both the API and the built frontend.
const BACKEND_URL = '';

type AuditData = {
  httpStatus: number;
  responseTimeMs: number;
  title: string | null;
  metaDescription: string | null;
  h1Count: number;
  imagesMissingAlt: number;
  wordCount: number;
};

type ErrorCase = 'invalid_url' | 'timeout' | 'non_html' | 'network_error' | 'internal_error';

type ApiError = {
  error: true;
  type: ErrorCase;
  message: string;
};

type RequestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: AuditData }
  | { status: 'error'; errorCase: ErrorCase; message: string };

export function PagePulseTool() {
  const [url, setUrl] = useState('');
  const [state, setState] = useState<RequestState>({ status: 'idle' });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setState({ status: 'loading' });

    try {
      const res = await fetch(`${BACKEND_URL}/api/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const payload = (await res.json()) as AuditData | ApiError;

      if (!res.ok && payload && 'error' in payload) {
        const apiErr = payload as ApiError;
        setState({
          status: 'error',
          errorCase: apiErr.type || 'network_error',
          message: apiErr.message,
        });
        return;
      }

      if (!res.ok) {
        setState({
          status: 'error',
          errorCase: 'non_html',
          message: 'The server returned an unexpected response.',
        });
        return;
      }

      setState({ status: 'success', data: payload as AuditData });
    } catch {
      setState({
        status: 'error',
        errorCase: 'timeout',
        message: 'Could not reach the audit service. Please try again.',
      });
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      <main className="flex-1 w-full max-w-2xl mx-auto px-5 py-12 sm:py-16">
        <header className="mb-8">
          <div className="flex items-center gap-2.5 mb-2">
            <Activity className="w-7 h-7 text-emerald-600" strokeWidth={2.5} />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Page Pulse
            </h1>
          </div>
          <p className="text-sm text-slate-500">
            Run a quick on-page audit of any URL. Get HTTP status, response
            time, metadata, and content stats in one report.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/page"
                aria-label="URL to audit"
                className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                disabled={state.status === 'loading'}
              />
            </div>
            <button
              type="submit"
              disabled={state.status === 'loading' || !url.trim()}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {state.status === 'loading' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Auditing
                </>
              ) : (
                'Audit'
              )}
            </button>
          </div>
        </form>

        <ErrorBoundary>
          {state.status === 'loading' && <LoadingState />}

          {state.status === 'error' && (
            <ErrorMessage
              errorCase={state.errorCase}
              message={state.message}
            />
          )}

          {state.status === 'success' && <ReportCard data={state.data} />}

          {state.status === 'idle' && <EmptyHint />}
        </ErrorBoundary>
      </main>

      <Footer />
    </div>
  );
}

function LoadingState() {
  const rows = [0, 1, 2, 3, 4, 5, 6];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-5 text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Analyzing the page...</span>
      </div>
      <div className="space-y-3">
        {rows.map((i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="h-4 w-32 rounded bg-slate-100 animate-pulse" />
            <div className="h-4 w-24 rounded bg-slate-100 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyHint() {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white/50 p-8 text-center">
      <AlertCircle className="w-6 h-6 text-slate-300 mx-auto mb-2" />
      <p className="text-sm text-slate-400">
        Enter a URL above and hit Audit to see the report card.
      </p>
    </div>
  );
}
