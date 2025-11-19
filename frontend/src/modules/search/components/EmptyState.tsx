interface EmptyStateProps {
  visible: boolean;
}

function EmptyState({ visible }: EmptyStateProps) {
  if (!visible) return null;

  return (
    <div className="text-center py-12 text-slate-500">
      <svg className="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <p className="text-lg font-medium">No results found</p>
      <p className="text-sm mt-2">Try a different query or adjust your filters</p>
    </div>
  );
}

export default EmptyState;

