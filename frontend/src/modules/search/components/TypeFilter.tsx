interface RecentItem {
  id: number;
  url: string;
  title?: string;
  type?: string;
}

interface TypeFilterProps {
  types: string[];
  availableTypes: string[];
  typeSearch: string;
  onTypeSearchChange: (value: string) => void;
  onTypeSelect: (type: string) => void;
  onTypeRemove: (type: string) => void;
  dropdownOpen: boolean;
  setDropdownOpen: (open: boolean) => void;
  fetchRecent: () => void;
  recentUrls: RecentItem[];
  recentLoading: boolean;
  onRecentClick: (item: RecentItem) => void;
}

function TypeFilter({
  types,
  availableTypes,
  typeSearch,
  onTypeSearchChange,
  onTypeSelect,
  onTypeRemove,
  dropdownOpen,
  setDropdownOpen,
  fetchRecent,
  recentUrls,
  recentLoading,
  onRecentClick,
}: TypeFilterProps) {
  const filteredTypes = availableTypes.filter((type) =>
    type.toLowerCase().includes(typeSearch.toLowerCase())
  );

  const disabled = availableTypes.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <label className="font-semibold text-slate-800 flex items-center gap-2">
        <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
          />
        </svg>
        Filter by Type or URL (optional):
      </label>
      <div className="relative border border-slate-200 rounded-2xl p-4 bg-slate-50 shadow-inner hover:border-sky-300 transition-colors">
        <div className="flex flex-wrap gap-2 mb-3">
          {types.map((type) => (
            <span
              key={type}
              className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-full text-sm font-medium inline-flex items-center gap-2"
            >
              {type}
              <button
                type="button"
                className="bg-transparent border-none cursor-pointer text-base text-slate-500 hover:text-slate-800 font-bold leading-none"
                onClick={() => onTypeRemove(type)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <input
          type="text"
          value={typeSearch}
          onChange={(e) => onTypeSearchChange(e.target.value)}
          onFocus={() => {
            setDropdownOpen(true);
            fetchRecent();
          }}
          onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
          placeholder={
            disabled ? "No types available yet" : 'Type e.g. "Tier 1" or paste part of a URL...'
          }
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition-all bg-white text-slate-900 placeholder:text-slate-400"
          disabled={disabled}
        />
        {disabled ? (
          <span className="text-slate-500 italic text-sm mt-3 block">
            No type filters available yet. Upload a CSV to populate types.
          </span>
        ) : (
          dropdownOpen && (
            <div className="absolute left-0 right-0 bg-white border-2 border-slate-200 rounded-2xl mt-2 max-h-64 overflow-y-auto z-20 shadow-[0_20px_60px_rgba(15,23,42,0.1)]">
              <div className="pb-2 border-b border-slate-100">
                <div className="text-xs font-bold text-slate-500 uppercase mb-1 px-4 pt-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                    />
                  </svg>
                  Types
                </div>
                {filteredTypes.length === 0 ? (
                  <div className="w-full text-left px-4 py-3 bg-transparent border-none cursor-default text-slate-400">
                    No matches
                  </div>
                ) : (
                  filteredTypes.slice(0, 20).map((type) => (
                    <button
                      type="button"
                      className="w-full text-left px-4 py-2.5 bg-transparent border-none cursor-pointer hover:bg-slate-100 transition-colors text-slate-700"
                      key={type}
                        onClick={() => {
                          setDropdownOpen(false);
                          onTypeSelect(type);
                        }}
                    >
                      {type}
                    </button>
                  ))
                )}
              </div>
              <div className="pb-2">
                <div className="text-xs font-bold text-slate-500 uppercase mb-1 px-4 pt-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Recent URLs
                </div>
                {recentLoading && (
                  <div className="w-full text-left px-4 py-3 bg-transparent border-none cursor-default text-slate-400">
                    Loading...
                  </div>
                )}
                {!recentLoading && recentUrls.length === 0 && (
                  <div className="w-full text-left px-4 py-3 bg-transparent border-none cursor-default text-slate-400">
                    No recent URLs yet
                  </div>
                )}
                {!recentLoading &&
                  recentUrls.map((item) => (
                    <button
                      type="button"
                      className="w-full flex flex-col items-start px-4 py-3 border-none bg-transparent cursor-pointer text-left hover:bg-slate-100 transition-colors rounded text-slate-800"
                      key={`${item.id}-${item.url}`}
                      onClick={() => {
                        setDropdownOpen(false);
                        onRecentClick(item);
                      }}
                    >
                      <span className="font-semibold text-slate-900 text-sm">
                        {item.title || item.url}
                      </span>
                      <span className="text-xs text-slate-500 truncate w-full">
                        {item.url}
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default TypeFilter;

