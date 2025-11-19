import { StatusResponse } from "../services/uploadService";

interface StatusPanelProps {
  status: StatusResponse | null;
  isPolling: boolean;
  uploadedCount: number;
}

function StatusPanel({ status, isPolling, uploadedCount }: StatusPanelProps) {
  if (!status || !isPolling) {
    return null;
  }

  const renderedUploadedCount = uploadedCount || status.database.total;
  const completionPercent =
    uploadedCount > 0
      ? Math.min((status.database.completed / uploadedCount) * 100, 100)
      : 0;

  return (
    <div className="mt-6 p-6 bg-slate-50 rounded-2xl border border-slate-200 shadow-inner">
      <h4 className="m-0 mb-5 text-slate-900 text-lg font-bold flex items-center gap-2">
        <svg className="w-5 h-5 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        Processing Status
      </h4>
      <div className="grid gap-4">
        <div className="flex justify-between items-center p-3 rounded-xl bg-white border border-slate-100">
          <span className="font-semibold text-slate-500">Queue</span>
          <span className="font-bold text-slate-900 text-lg">
            {status.queue.active} active · {status.queue.waiting} waiting
          </span>
        </div>
        <div className="flex justify-between items-center p-3 rounded-xl bg-white border border-slate-100">
          <span className="font-semibold text-slate-500">Completed</span>
          <span className="font-bold text-emerald-600 text-lg">
            {status.database.completed} / {renderedUploadedCount}
          </span>
        </div>
        <div className="flex justify-between items-center p-3 rounded-xl bg-white border border-slate-100">
          <span className="font-semibold text-slate-500">Failed</span>
          <span className="font-bold text-rose-600 text-lg">{status.database.failed}</span>
        </div>
        {uploadedCount > 0 && (
          <div className="mt-2 w-full h-3 bg-slate-200 rounded-full overflow-hidden shadow-inner border border-white">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-sky-500 to-teal-400 transition-all duration-500 ease-out rounded-full"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default StatusPanel;

