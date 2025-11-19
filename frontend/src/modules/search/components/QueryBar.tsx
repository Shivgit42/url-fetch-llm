interface QueryBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onEnter: () => void;
  searching: boolean;
  canSearch: boolean;
}

function QueryBar({
  query,
  onQueryChange,
  onSearch,
  onEnter,
  searching,
  canSearch,
}: QueryBarProps) {
  return (
    <div className="flex gap-3 relative flex-col sm:flex-row">
      <div className="flex-1 relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && onEnter()}
          placeholder="e.g., facebook, machine learning, web development..."
          className="w-full pl-12 pr-4 py-4 border-2 border-slate-200 rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition-all shadow-sm bg-white text-slate-900 placeholder:text-slate-400"
        />
      </div>
      <button
        onClick={onSearch}
        disabled={!canSearch || searching}
        className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-base font-semibold cursor-pointer hover:bg-slate-800 disabled:bg-slate-400 disabled:text-white/80 disabled:cursor-not-allowed transition-all duration-200 shadow-md"
      >
        {searching ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Searching...
          </span>
        ) : (
          "Search"
        )}
      </button>
    </div>
  );
}

export default QueryBar;

