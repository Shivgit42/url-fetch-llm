function SearchHero() {
  return (
    <div className="mb-8 space-y-3">
      <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs tracking-[0.25em] uppercase bg-slate-100 text-slate-500 border border-slate-200">
        Search
      </span>
      <h2 className="text-3xl sm:text-4xl font-black text-slate-900">
        Search URLs
      </h2>
      <p className="text-slate-500 text-sm sm:text-base">
        Enter a search query to find relevant URLs using semantic search
      </p>
    </div>
  );
}

export default SearchHero;

