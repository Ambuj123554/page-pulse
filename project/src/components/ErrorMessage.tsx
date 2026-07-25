import { AlertTriangle, Clock, LinkIcon, FileX, WifiOff, ServerCrash, Bug } from 'lucide-react';

type ErrorCase = 'invalid_url' | 'timeout' | 'non_html' | 'network_error' | 'internal_error';

interface ErrorMeta {
  icon: React.ReactNode;
  title: string;
  hint: string;
}

const ERROR_META: Record<ErrorCase, ErrorMeta> = {
  invalid_url: {
    icon: <LinkIcon className="w-5 h-5" />,
    title: 'Invalid URL',
    hint: "That doesn't look like a valid URL. Make sure it includes the protocol, like https://example.com.",
  },
  timeout: {
    icon: <Clock className="w-5 h-5" />,
    title: 'Request Timed Out',
    hint: 'The page took too long to respond. Try again, or check a different URL.',
  },
  non_html: {
    icon: <FileX className="w-5 h-5" />,
    title: 'Not an HTML Page',
    hint: 'The URL returned something other than an HTML page, so it cannot be audited.',
  },
  network_error: {
    icon: <WifiOff className="w-5 h-5" />,
    title: 'Network Error',
    hint: 'Could not reach the target server. The domain may not exist, the connection may have been refused, or the server is unreachable.',
  },
  internal_error: {
    icon: <ServerCrash className="w-5 h-5" />,
    title: 'Server Error',
    hint: 'An unexpected error occurred on the server. Please try again later.',
  },
};

/** Fallback shown when the error case is not recognized at runtime. */
const FALLBACK_META: ErrorMeta = {
  icon: <Bug className="w-5 h-5" />,
  title: 'Unexpected Error',
  hint: 'Something went wrong while processing the request.',
};

export function ErrorMessage({
  errorCase,
  message,
}: {
  errorCase: ErrorCase;
  message: string;
}) {
  // Always fall back to FALLBACK_META if the errorCase is unrecognized
  // or missing — never index into ERROR_META without a guard.
  const meta = ERROR_META[errorCase] ?? FALLBACK_META;

  return (
    <div
      role="alert"
      className="rounded-xl border border-amber-200 bg-amber-50 p-5"
    >
      <div className="flex items-start gap-3">
        <div className="text-amber-600 mt-0.5">{meta.icon}</div>
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <h3 className="text-sm font-semibold text-amber-900">
              {meta.title}
            </h3>
          </div>
          <p className="text-sm text-amber-800">{meta.hint}</p>
          <p className="text-xs text-amber-600 mt-2 italic">{message}</p>
        </div>
      </div>
    </div>
  );
}
