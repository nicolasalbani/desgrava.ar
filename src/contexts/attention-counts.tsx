"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useFiscalYear } from "@/contexts/fiscal-year";

interface AttentionCountsContextType {
  facturas: number;
  recibos: number;
  /** Call after a local mutation that changes attention state */
  invalidate: () => void;
}

const AttentionCountsContext = createContext<AttentionCountsContextType>({
  facturas: 0,
  recibos: 0,
  invalidate: () => {},
});

export function AttentionCountsProvider({ children }: { children: React.ReactNode }) {
  const { fiscalYear } = useFiscalYear();
  const [facturas, setFacturas] = useState(0);
  const [recibos, setRecibos] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(1000);
  const connectRef = useRef<() => void>(() => {});

  const buildUrl = useCallback(
    (path: string) => {
      const params = fiscalYear ? `?fiscalYear=${fiscalYear}` : "";
      return `${path}${params}`;
    },
    [fiscalYear],
  );

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch(buildUrl("/api/attention-counts"));
      if (res.ok) {
        const data = await res.json();
        setFacturas(data.facturas);
        setRecibos(data.recibos);
      }
    } catch {
      // Silently fail, SSE will pick up
    }
  }, [buildUrl]);

  // Keep connectRef in sync so the reconnect timeout uses the latest closure
  useEffect(() => {
    connectRef.current = () => {
      // Clean up existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      const es = new EventSource(buildUrl("/api/attention-counts/stream"));
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setFacturas(data.facturas);
          setRecibos(data.recibos);
          reconnectDelayRef.current = 1000;
        } catch {
          // Ignore parse errors
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;

        const delay = reconnectDelayRef.current;
        reconnectDelayRef.current = Math.min(delay * 2, 30000);
        reconnectTimeoutRef.current = setTimeout(() => connectRef.current(), delay);
      };
    };
  }, [buildUrl]);

  // Initial fetch + SSE connection
  useEffect(() => {
    fetchCounts();
    connectRef.current();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [fetchCounts, buildUrl]);

  const invalidate = useCallback(() => {
    fetchCounts();
  }, [fetchCounts]);

  return (
    <AttentionCountsContext.Provider value={{ facturas, recibos, invalidate }}>
      {children}
    </AttentionCountsContext.Provider>
  );
}

export function useAttentionCounts() {
  return useContext(AttentionCountsContext);
}
