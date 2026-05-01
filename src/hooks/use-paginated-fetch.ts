"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface Filters {
  [key: string]: string | string[] | undefined;
}

interface UsePaginatedFetchOptions<T> {
  /** API endpoint path, e.g. "/api/comprobantes" */
  url: string;
  /** Key in the response JSON that holds the array, e.g. "invoices" */
  dataKey: string;
  /** Static params that don't reset pagination (e.g. fiscalYear) */
  staticParams?: Record<string, string | undefined>;
  /** Transform items after fetching (optional) */
  transform?: (items: T[]) => T[];
  /** Called once after the first successful load */
  onInitialLoad?: (totalCount: number) => void;
  /** Poll interval in ms. Default: 5000 */
  pollInterval?: number;
}

interface UsePaginatedFetchReturn<T> {
  data: T[];
  setData: React.Dispatch<React.SetStateAction<T[]>>;
  pagination: PaginationMeta;
  loading: boolean;
  filters: Filters;
  setFilters: (filters: Filters) => void;
  updateFilter: (key: string, value: string | string[] | undefined) => void;
  search: string;
  setSearch: (value: string) => void;
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  refetch: () => void;
  polling: boolean;
  setShouldPoll: (value: boolean) => void;
  /** Extra fields from the API response (beyond data and pagination) */
  meta: Record<string, unknown>;
}

export function buildParams(
  page: number,
  pageSize: number,
  debouncedSearch: string,
  staticParams: Record<string, string | undefined> | undefined,
  filters: Filters,
): string {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));

  if (debouncedSearch) params.set("search", debouncedSearch);

  if (staticParams) {
    for (const [key, value] of Object.entries(staticParams)) {
      if (value !== undefined && value !== "") params.set(key, value);
    }
  }

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, value.join(","));
    } else if (value !== "") {
      params.set(key, value);
    }
  }

  return params.toString();
}

export function usePaginatedFetch<T>(
  options: UsePaginatedFetchOptions<T>,
): UsePaginatedFetchReturn<T> {
  const { url, dataKey, staticParams, transform, onInitialLoad, pollInterval = 5000 } = options;

  const [data, setData] = useState<T[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 10,
    totalCount: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filters, setFiltersRaw] = useState<Filters>({});
  const [search, setSearchRaw] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPageRaw] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(10);
  const [shouldPoll, setShouldPoll] = useState(false);
  const [meta, setMeta] = useState<Record<string, unknown>>({});

  const initialLoadRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stash optional callbacks in refs so unstable references from callers
  // don't invalidate `fetchData` and cause spurious refetches.
  const transformRef = useRef(transform);
  const onInitialLoadRef = useRef(onInitialLoad);
  useEffect(() => {
    transformRef.current = transform;
    onInitialLoadRef.current = onInitialLoad;
  }, [transform, onInitialLoad]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      // Only reset page if search actually changed
      setPageRaw(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchData = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);
      try {
        const qs = buildParams(page, pageSize, debouncedSearch, staticParams, filters);
        const res = await fetch(`${url}?${qs}`);
        if (!res.ok) throw new Error("Fetch failed");
        const json = await res.json();
        let items: T[] = json[dataKey] ?? [];
        if (transformRef.current) items = transformRef.current(items);
        setData(items);
        if (json.pagination) setPagination(json.pagination);

        // Extract extra response fields as meta
        const { [dataKey]: _items, pagination: _pag, ...rest } = json;
        setMeta(rest);

        if (!initialLoadRef.current && showLoading) {
          initialLoadRef.current = true;
          onInitialLoadRef.current?.(json.pagination?.totalCount ?? items.length);
        }
      } catch {
        // Silently fail
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [url, dataKey, page, pageSize, debouncedSearch, staticParams, filters],
  );

  // Fetch on dependency changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling
  useEffect(() => {
    if (shouldPoll && !pollRef.current) {
      pollRef.current = setInterval(() => fetchData(false), pollInterval);
    } else if (!shouldPoll && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [shouldPoll, fetchData, pollInterval]);

  const setFilters = useCallback((newFilters: Filters) => {
    setFiltersRaw(newFilters);
    setPageRaw(1);
  }, []);

  const updateFilter = useCallback((key: string, value: string | string[] | undefined) => {
    setFiltersRaw((prev) => ({ ...prev, [key]: value }));
    setPageRaw(1);
  }, []);

  const setPage = useCallback((p: number) => setPageRaw(p), []);

  const setPageSize = useCallback((size: number) => {
    setPageSizeRaw(size);
    setPageRaw(1);
  }, []);

  const setSearch = useCallback((value: string) => setSearchRaw(value), []);

  const refetch = useCallback(() => fetchData(false), [fetchData]);

  return {
    data,
    setData,
    pagination,
    loading,
    filters,
    setFilters,
    updateFilter,
    search,
    setSearch,
    page,
    setPage,
    pageSize,
    setPageSize,
    refetch,
    polling: shouldPoll,
    setShouldPoll,
    meta,
  };
}
