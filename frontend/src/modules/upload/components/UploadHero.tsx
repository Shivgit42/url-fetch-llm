function UploadHero() {
  return (
    <div className="mb-10 space-y-3">
      <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs tracking-[0.25em] uppercase bg-slate-100 text-slate-500 border border-slate-200">
        Upload
      </span>
      <h2 className="text-3xl sm:text-4xl font-black text-slate-900">
        Upload CSV File
      </h2>
      <p className="text-slate-500 text-sm sm:text-base">
        Select and upload your CSV file to start processing URLs
      </p>
    </div>
  );
}

export default UploadHero;

