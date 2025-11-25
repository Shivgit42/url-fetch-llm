import { useState, useEffect } from "react";
import SearchHero from "../components/SearchHero";
import QueryBar from "../components/QueryBar";
import TypeFilter from "../components/TypeFilter";
import ResultCountControl from "../components/ResultCountControl";
import ErrorBanner from "../components/ErrorBanner";
import ResultsSection from "../components/ResultsSection";
import EmptyState from "../components/EmptyState";
import { performSearch, fetchTypes } from "../services/searchService";

const MIN_RESULTS = 1;

function SearchPresenter() {
  const [query, setQuery] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [typeSearch, setTypeSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultCount, setResultCount] = useState<number>(0);
  const [resultCountInput, setResultCountInput] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [totalAvailable, setTotalAvailable] = useState<number>(0);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  useEffect(() => {
    const loadTypes = async () => {
      try {
        const response = await fetchTypes();
        setAvailableTypes(response.data.types);
      } catch (err) {}
    };
    loadTypes();
  }, []);

  const handleTypeSelect = (type: string) => {
    setTypes((prev) => (prev.includes(type) ? prev : [...prev, type]));
    setTypeSearch("");
    setPage(1);
  };

  const handleTypeRemove = (type: string) => {
    setTypes((prev) => prev.filter((t) => t !== type));
    setPage(1);
  };

  const clampResultCount = (value: number) =>
    Math.max(value || MIN_RESULTS, MIN_RESULTS);

  const handleResultInputChange = (rawValue: string) => {
    const digitsOnly = rawValue.replace(/\D/g, "");
    setResultCountInput(digitsOnly);

    if (digitsOnly === "") {
      setResultCount(0);
      setPage(1);
      return;
    }

    const numericValue = Number(digitsOnly);
    if (!Number.isNaN(numericValue) && numericValue > 0) {
      const clamped = clampResultCount(numericValue);
      setResultCount(clamped);
      if (clamped !== numericValue) {
        setResultCountInput(String(clamped));
      }
      setPage(1);
    }
  };

  const handleSearch = async (
    selectedQuery?: string,
    pageOverride?: number
  ) => {
    const rawQuery = selectedQuery ?? query;
    const fallbackQuery =
      rawQuery.trim().length > 0
        ? rawQuery.trim()
        : types.length > 0
        ? types.join(" ")
        : "";

    if (!fallbackQuery) {
      setError("Please enter a search query or select at least one type.");
      return;
    }

    if (!resultCount || resultCount < MIN_RESULTS) {
      setError("Please enter the number of results to display.");
      return;
    }

    const safeCount = clampResultCount(resultCount);
    const targetPage = pageOverride ?? 1;
    setSearching(true);
    setError(null);

    try {
      const response = await performSearch({
        query: fallbackQuery,
        types: types.length > 0 ? types : undefined,
        perPage: safeCount,
        page: targetPage,
        typeFilterText: typeSearch.trim() || undefined,
      });

      // CRITICAL: Ensure we never display more results than requested
      const receivedResults = response.data.results || [];
      const maxResults = safeCount;
      
      // Remove any null/undefined entries first
      const cleanResults = receivedResults.filter(r => r != null);
      
      // Strictly limit to exactly maxResults - take only the first maxResults items
      const limitedResults = cleanResults.slice(0, maxResults);
      
      // ABSOLUTE FINAL CHECK: Ensure we have exactly maxResults or fewer
      // If we somehow have more, force truncate
      if (limitedResults.length > maxResults) {
        console.error(`[frontend] ERROR: limitedResults.length (${limitedResults.length}) > maxResults (${maxResults}), force truncating!`);
        limitedResults.splice(maxResults);
      }
      
      // ABSOLUTE FINAL: Ensure we have exactly maxResults (or fewer if not enough available)
      // Remove duplicates by ID to be extra safe
      const uniqueResults = limitedResults.filter((result, index, self) => 
        index === self.findIndex(r => r.id === result.id)
      );
      
      // Take exactly maxResults
      const exactResults = uniqueResults.slice(0, maxResults);
      
      // Final verification - if we have more than requested, force truncate
      if (exactResults.length > maxResults) {
        console.error(`[frontend] CRITICAL: exactResults.length (${exactResults.length}) > maxResults (${maxResults}), force truncating!`);
        exactResults.splice(maxResults);
      }
      
      // Final safety check - log error only if critical issue
      if (exactResults.length > maxResults) {
        console.error(`[frontend] ERROR: exactResults.length (${exactResults.length}) > maxResults (${maxResults})!`);
      }
      
      setResults(exactResults);
      setPage(response.data.meta?.page ?? targetPage);
      setTotalAvailable(
        response.data.meta?.totalAvailable ?? limitedResults.length
      );
    } catch (err: any) {
      setError(err.response?.data?.error || "Search failed. Please try again.");
      setResults([]);
      setTotalAvailable(0);
    } finally {
      setSearching(false);
    }
  };

  const hasPrevious = page > 1;
  // Only show "Next" if:
  // 1. We haven't shown all the requested results yet (results.length < resultCount), AND
  // 2. There are more results available (totalAvailable > results.length)
  // If user requested 20 results and we're showing 20, don't show "Next" (user only wants 20 total)
  const hasNext = results.length < resultCount && totalAvailable > results.length;
  const canSearch = (query.trim().length > 0 || types.length > 0) && resultCount >= MIN_RESULTS;

  return (
    <div className="w-full">
      <div className="bg-white rounded-2xl p-6 sm:p-8 lg:p-10 shadow-[0_30px_80px_rgba(15,23,42,0.08)] border border-white text-slate-900">
        <SearchHero />

        <div className="flex flex-col gap-6 mb-8">
          <QueryBar
            query={query}
            onQueryChange={(value) => {
              setQuery(value);
              setPage(1);
            }}
            onSearch={() => handleSearch()}
            onEnter={() => handleSearch()}
            searching={searching}
            canSearch={canSearch}
          />

          <TypeFilter
            types={types}
            availableTypes={availableTypes}
            typeSearch={typeSearch}
            onTypeSearchChange={(value) => {
              setTypeSearch(value);
              setPage(1);
            }}
            onTypeSelect={handleTypeSelect}
            onTypeRemove={handleTypeRemove}
            dropdownOpen={showTypeDropdown}
            setDropdownOpen={setShowTypeDropdown}
          />

          <ResultCountControl
            value={resultCountInput}
            onChange={handleResultInputChange}
          />

          {error && <ErrorBanner message={error} />}
        </div>

        {results.length > 0 && (
          <ResultsSection
            results={results}
            page={page}
            resultCount={resultCount}
            totalAvailable={totalAvailable}
            onNext={() => handleSearch(undefined, page + 1)}
            onPrev={() => handleSearch(undefined, page - 1)}
            hasNext={hasNext}
            hasPrevious={hasPrevious}
            searching={searching}
          />
        )}

        <EmptyState
          visible={results.length === 0 && !searching && !!query && !error}
        />
      </div>
    </div>
  );
}

export default SearchPresenter;

