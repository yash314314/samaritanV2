"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseApiOptions {
  enabled?: boolean;
  refetchInterval?: number;
}

export function useApi<T>(
  fetchFn: () => Promise<T>,
  options: UseApiOptions = {}
) {
  const { enabled = true, refetchInterval } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false); // ← start false, set true on first fetch
  const [error, setError] = useState<Error | null>(null);
  
  // Use refs to avoid dependency issues
  const fetchFnRef = useRef(fetchFn);
  const isMountedRef = useRef(true);
  
  // Update ref when fetchFn changes, but don't trigger effect
  useEffect(() => {
    fetchFnRef.current = fetchFn;
  }, [fetchFn]);

  const refetch = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await fetchFnRef.current();
      if (isMountedRef.current) {
        setData(result);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []); // ← NO dependencies! Uses ref internally

  // Initial fetch + interval
  useEffect(() => {
    isMountedRef.current = true;
    
    if (!enabled) return;

    // Initial fetch
    refetch();

    // Interval polling
    let interval: NodeJS.Timeout;
    if (refetchInterval && refetchInterval > 0) {
      interval = setInterval(() => {
        if (isMountedRef.current) {
          refetch();
        }
      }, refetchInterval);
    }

    return () => {
      isMountedRef.current = false;
      if (interval) clearInterval(interval);
    };
  }, [enabled, refetchInterval]); // ← refetch is NOT in dependencies!

  return { data, loading, error, refetch };
}