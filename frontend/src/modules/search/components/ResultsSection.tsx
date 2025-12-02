interface SearchResult {
  id: string;
  url: string;
  title?: string;
  type?: string;
  score: number;
  originalScore?: number;
  recencyBoost?: number;
  snippet?: string;
  highlights?: string[];
}

function buildPhrasesFromText(
  text: string | undefined,
  maxPhrases: number = 5
): string[] {
  if (!text) return [];

  const cleaned = text.replace(/[^a-zA-Z0-9\s]/g, " ").toLowerCase();
  const tokens = cleaned.split(/\s+/).filter((t) => t.length > 2);
  if (tokens.length === 0) return [];

  const stopWords = new Set([
    "the",
    "and",
    "for",
    "you",
    "are",
    "with",
    "that",
    "from",
    "this",
    "your",
    "have",
    "will",
    "not",
    "but",
    "was",
    "were",
    "can",
    "our",
    "about",
    "into",
    "then",
    "than",
    "them",
    "they",
    "there",
    "what",
    "when",
    "where",
    "which",
    "while",
    "also",
    "just",
    "like",
  ]);

  type PhraseInfo = { phrase: string; score: number };
  const phraseScores = new Map<string, PhraseInfo>();

  for (let i = 0; i < tokens.length; i++) {
    const w1 = tokens[i];
    if (stopWords.has(w1)) continue;

    const single = w1;
    const existingSingle = phraseScores.get(single);
    if (existingSingle) {
      existingSingle.score += 1;
    } else {
      phraseScores.set(single, { phrase: single, score: 1 });
    }

    if (i + 1 < tokens.length) {
      const w2 = tokens[i + 1];
      if (stopWords.has(w2)) continue;
      const two = `${w1} ${w2}`;
      const existingTwo = phraseScores.get(two);
      if (existingTwo) {
        existingTwo.score += 2;
      } else {
        phraseScores.set(two, { phrase: two, score: 2 });
      }
    }
  }

  const ranked = Array.from(phraseScores.values()).sort(
    (a, b) => b.score - a.score
  );

  const seen = new Set<string>();
  const phrases: string[] = [];

  for (const item of ranked) {
    const words = item.phrase.split(" ");
    if (words.length === 0 || words.length > 2) continue;

    const phrase = words
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    const key = phrase.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    phrases.push(phrase);

    if (phrases.length >= maxPhrases) break;
  }

  return phrases;
}

interface ResultsSectionProps {
  results: SearchResult[];
  page: number;
  resultCount: number;
  totalAvailable: number;
  onNext: () => void;
  onPrev: () => void;
  hasNext: boolean;
  hasPrevious: boolean;
  searching: boolean;
}

function ResultsSection({
  results,
  page,
  resultCount,
  totalAvailable,
  onNext,
  onPrev,
  hasNext,
  hasPrevious,
  searching,
}: ResultsSectionProps) {
  const startResult = results.length === 0 ? 0 : (page - 1) * resultCount + 1;
  const endResult = startResult + results.length - 1;

  return (
    <div className="mt-10 pt-8 border-t border-slate-200">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-slate-900">
          Results <span className="text-sky-500">({results.length})</span>
        </h3>
      </div>
      <div className="flex flex-col gap-5">
        {results.slice(0, resultCount).filter(r => r != null).map((result) => (
          <div
            key={result.id}
            className="p-6 border border-slate-200 rounded-2xl transition-all duration-200 hover:shadow-[0_15px_50px_rgba(15,23,42,0.12)] hover:border-sky-200 bg-white text-slate-900"
          >
            <div className="flex justify-between items-start gap-4 mb-3 flex-col sm:flex-row">
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-xl font-bold text-slate-900 no-underline break-words hover:text-sky-600 hover:underline transition-colors"
              >
                {result.title || result.url}
              </a>
              <span className="px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap bg-slate-100 text-slate-700 border border-slate-200">
                {result.type}
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-500 text-sm mb-3 break-all">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
              {result.url}
            </div>
            {(() => {
              const phrases =
                (result.highlights && result.highlights.length > 0
                  ? result.highlights
                  : buildPhrasesFromText(result.snippet)
                ).slice(0, 5);

              if (phrases.length === 0) {
                return null;
              }

              return (
                <ul className="text-slate-700 text-sm mb-4 leading-relaxed p-3 bg-slate-50 rounded-lg border-l-4 border-sky-400/60 list-disc list-inside space-y-1">
                  {phrases.map((phrase, index) => (
                    <li key={index}>{phrase}</li>
                  ))}
                </ul>
              );
            })()}
            <div className="flex items-center gap-4 flex-wrap pt-3 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">
                  Relevance:
                </span>
                <span className="text-sm font-bold text-sky-600">
                  {(result.score * 100).toFixed(1)}%
                </span>
              </div>
              {result.originalScore !== undefined && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Semantic:</span>
                    <span className="text-xs font-medium text-slate-700">
                      {(result.originalScore * 100).toFixed(1)}%
                    </span>
                  </div>
                  {result.recencyBoost !== undefined && result.recencyBoost > 0 && (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                      <span className="text-xs font-semibold text-emerald-600">
                        +{(result.recencyBoost * 100).toFixed(1)}% Recent
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 p-5 bg-slate-50 rounded-2xl border border-slate-200">
        <div className="text-sm font-semibold text-slate-700 mb-3">
          Showing
          <span className="text-sky-500">
            {" "}
            {results.length > 0 ? startResult : 0}-{endResult}{" "}
          </span>
          of
          <span className="text-sky-500"> {results.length} </span>
          {results.length === 1 ? "result" : "results"}
          {totalAvailable > results.length && (
            <span className="text-slate-500">
              {" "}
              (out of {totalAvailable} total available)
            </span>
          )}
        </div>
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            className="px-6 py-2.5 border border-slate-200 rounded-2xl bg-white cursor-pointer text-sm font-semibold text-slate-600 hover:text-sky-500 hover:border-sky-300 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={onPrev}
            disabled={!hasPrevious || searching}
          >
            ← Previous
          </button>
          <span className="px-4 py-2 bg-white rounded-2xl border border-slate-200 font-bold text-slate-700">
            Page {page}
          </span>
          <button
            type="button"
            className="px-6 py-2.5 border border-slate-200 rounded-2xl bg-white cursor-pointer text-sm font-semibold text-slate-600 hover:text-sky-500 hover:border-sky-300 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={onNext}
            disabled={!hasNext || searching}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

export default ResultsSection;

