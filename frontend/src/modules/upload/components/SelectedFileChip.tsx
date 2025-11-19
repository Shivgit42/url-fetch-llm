interface SelectedFileChipProps {
  fileName: string;
  onClear: () => void;
}

function SelectedFileChip({ fileName, onClear }: SelectedFileChipProps) {
  return (
    <div className="px-4 py-3 bg-slate-900 text-white rounded-2xl border border-slate-900 flex items-center justify-between flex-wrap gap-2 shadow-inner shadow-slate-700/30">
      <div className="flex items-center gap-2">
        <svg
          className="w-5 h-5 text-cyan-200"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <span className="font-medium text-slate-200">Selected:</span>
        <strong className="text-white">{fileName}</strong>
      </div>
      <button
        type="button"
        className="text-sm text-cyan-200 underline"
        onClick={onClear}
      >
        Remove
      </button>
    </div>
  );
}

export default SelectedFileChip;

