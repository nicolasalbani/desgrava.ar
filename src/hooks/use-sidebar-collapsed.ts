"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "desgrava:sidebar-collapsed";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function readPersistedCollapsed(storage: StorageLike | null): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function writePersistedCollapsed(storage: StorageLike | null, value: boolean): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, value ? "true" : "false");
  } catch {
    // localStorage may be unavailable (private mode, quota exceeded) — silent no-op
  }
}

export function shouldHandleToggleKey(event: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  target: EventTarget | null;
}): boolean {
  if (event.key !== "[") return false;
  if (event.metaKey || event.ctrlKey || event.altKey) return false;
  const target = event.target;
  if (target && typeof (target as Element).tagName === "string") {
    const el = target as HTMLElement;
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return false;
    if (el.isContentEditable) return false;
  }
  return true;
}

function getStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function useSidebarCollapsed() {
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    setCollapsedState(readPersistedCollapsed(getStorage()));
  }, []);

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value);
    writePersistedCollapsed(getStorage(), value);
  }, []);

  const toggle = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      writePersistedCollapsed(getStorage(), next);
      return next;
    });
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!shouldHandleToggleKey(event)) return;
      event.preventDefault();
      toggle();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle]);

  return { collapsed, setCollapsed, toggle };
}
