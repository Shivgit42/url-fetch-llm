import { useState, useEffect } from "react";
import SearchHero from "../components/SearchHero";
import QueryBar from "../components/QueryBar";
import TypeFilter from "../components/TypeFilter";
import ResultCountControl from "../components/ResultCountControl";
import ErrorBanner from "../components/ErrorBanner";
import ResultsSection from "../components/ResultsSection";
import EmptyState from "../components/EmptyState";
import {
  performSearch,
  fetchTypes,
  fetchRecentUrls,
} from "../services/searchService";

const MAX_RESULTS = 200;
const MIN_RESULTS = 1;

function SearchPresenter() {
  const [query, setQuery] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [typeSearch, setTypeSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultCount, setResultCount] = useState<number>(20);
  const [resultCountInput, setResultCountInput] = useState<string>("20");
  const [page, setPage] = useState<number>(1);
  const [totalAvailable, setTotalAvailable] = useState<number>(0);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [recentUrls, setRecentUrls] = useState<any[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentLoaded, setRecentLoaded] = useState(false);

  useEffect(() => {
    const loadTypes = async () => {
      try {
        const response = await fetchTypes();
        setAvailableTypes(response.data.types);
      } catch (err) {}
    };
    loadTypes();
  }, []);

  const fetchRecent = async () => {
    if (recentLoaded || recentLoading) return;
    setRecentLoading(true);
    try {
      const response = await fetchRecentUrls();
      setRecentUrls(response.data.recent);
      setRecentLoaded(true);
    } catch (err) {
    } finally {
      setRecentLoading(false);
    }
  };

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
    Math.min(Math.max(value || MIN_RESULTS, MIN_RESULTS), MAX_RESULTS);

  const handleResultInputChange = (rawValue: string) => {
    const digitsOnly = rawValue.replace(/\D/g, "");
    setResultCountInput(digitsOnly);

    if (digitsOnly === "") {
      setResultCount(MIN_RESULTS);
      setPage(1);
      return;
    }

    const numericValue = Number(digitsOnly);
    if (!Number.isNaN(numericValue)) {
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

      setResults(response.data.results);
      setPage(response.data.meta?.page ?? targetPage);
      setTotalAvailable(
        response.data.meta?.totalAvailable ?? response.data.results.length
      );
    } catch (err: any) {
      setError(err.response?.data?.error || "Search failed. Please try again.");
      setResults([]);
      setTotalAvailable(0);
    } finally {
      setSearching(false);
    }
  };

  const handleRecentClick = (item: { title?: string; url: string }) => {
    const queryValue = item.title?.trim() || item.url;
    if (!queryValue) return;
    setQuery(queryValue);
    setShowTypeDropdown(false);
    handleSearch(queryValue);
  };

  const hasPrevious = page > 1;
  const hasNext = totalAvailable > page * resultCount;
  const canSearch = query.trim().length > 0 || types.length > 0;

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
            fetchRecent={fetchRecent}
            recentUrls={recentUrls}
            recentLoading={recentLoading}
            onRecentClick={handleRecentClick}
          />

          <ResultCountControl
            value={resultCountInput}
            onChange={handleResultInputChange}
            maxResults={MAX_RESULTS}
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

