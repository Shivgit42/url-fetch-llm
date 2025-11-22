interface ResultCountControlProps {
  value: string;
  onChange: (value: string) => void;
}

function ResultCountControl({ value, onChange }: ResultCountControlProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
      <label
        htmlFor="result-count-input"
        className="font-semibold text-slate-800"
      >
        Results to display:
      </label>
      <input
        id="result-count-input"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-20 px-3 py-2 border-2 border-slate-200 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent font-semibold text-center"
      />
      <span className="text-sm text-slate-500">Enter number of results</span>
    </div>
  );
}

export default ResultCountControl;
