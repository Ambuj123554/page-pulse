import { CheckCircle2, XCircle, Clock, FileText, Type, ImageOff, Heading1 } from 'lucide-react';

type AuditData = {
  httpStatus: number;
  responseTimeMs: number;
  title: string | null;
  metaDescription: string | null;
  h1Count: number;
  imagesMissingAlt: number;
  wordCount: number;
};

export function ReportCard({ data }: { data: AuditData }) {
  const statusOk = data.httpStatus >= 200 && data.httpStatus < 400;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-center gap-2">
          {statusOk ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          ) : (
            <XCircle className="w-5 h-5 text-rose-600" />
          )}
          <h2 className="text-base font-semibold text-slate-900">
            Audit Report
          </h2>
        </div>
      </div>

      <dl className="divide-y divide-slate-100">
        <Metric
          icon={<StatusIcon ok={statusOk} code={data.httpStatus} />}
          label="HTTP Status"
          value={`${data.httpStatus}`}
        />
        <Metric
          icon={<Clock className="w-4 h-4 text-slate-400" />}
          label="Response Time"
          value={`${data.responseTimeMs} ms`}
        />
        <Metric
          icon={<Type className="w-4 h-4 text-slate-400" />}
          label="Title"
          value={data.title ?? '—'}
        />
        <Metric
          icon={<FileText className="w-4 h-4 text-slate-400" />}
          label="Meta Description"
          value={data.metaDescription ?? '—'}
        />
        <Metric
          icon={<Heading1 className="w-4 h-4 text-slate-400" />}
          label="H1 Count"
          value={`${data.h1Count}`}
        />
        <Metric
          icon={<ImageOff className="w-4 h-4 text-slate-400" />}
          label="Images Missing Alt"
          value={`${data.imagesMissingAlt}`}
          valueClass={data.imagesMissingAlt > 0 ? 'text-amber-600' : 'text-slate-800'}
        />
        <Metric
          icon={<FileText className="w-4 h-4 text-slate-400" />}
          label="Word Count"
          value={`${data.wordCount}`}
        />
      </dl>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  valueClass = 'text-slate-800',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-3.5">
      <div className="flex items-center gap-2.5 min-w-0">
        {icon}
        <dt className="text-sm text-slate-500 whitespace-nowrap">{label}</dt>
      </div>
      <dd className={`text-sm font-medium text-right truncate ${valueClass}`}>
        {value}
      </dd>
    </div>
  );
}

function StatusIcon({ ok, code }: { ok: boolean; code: number }) {
  return ok ? (
    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
  ) : (
    <XCircle className="w-4 h-4 text-rose-600" />
  );
}
