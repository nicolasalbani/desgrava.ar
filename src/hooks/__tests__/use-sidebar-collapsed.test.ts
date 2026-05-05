import { describe, it, expect, vi } from "vitest";
import {
  readPersistedCollapsed,
  writePersistedCollapsed,
  shouldHandleToggleKey,
} from "@/hooks/use-sidebar-collapsed";

function makeStorage(initial: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initial };
  return {
    store,
    api: {
      getItem: vi.fn((key: string) => (key in store ? store[key] : null)),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
    },
  };
}

describe("readPersistedCollapsed", () => {
  it("returns false when storage is null", () => {
    expect(readPersistedCollapsed(null)).toBe(false);
  });

  it("returns false when key is absent", () => {
    const { api } = makeStorage();
    expect(readPersistedCollapsed(api)).toBe(false);
  });

  it("returns true when stored value is 'true'", () => {
    const { api } = makeStorage({ "desgrava:sidebar-collapsed": "true" });
    expect(readPersistedCollapsed(api)).toBe(true);
  });

  it("returns false for any non-'true' value", () => {
    const { api } = makeStorage({ "desgrava:sidebar-collapsed": "false" });
    expect(readPersistedCollapsed(api)).toBe(false);
    const garbage = makeStorage({ "desgrava:sidebar-collapsed": "garbage" });
    expect(readPersistedCollapsed(garbage.api)).toBe(false);
  });

  it("returns false when getItem throws", () => {
    const api = {
      getItem: vi.fn(() => {
        throw new Error("denied");
      }),
      setItem: vi.fn(),
    };
    expect(readPersistedCollapsed(api)).toBe(false);
  });
});

describe("writePersistedCollapsed", () => {
  it("is a no-op when storage is null", () => {
    expect(() => writePersistedCollapsed(null, true)).not.toThrow();
  });

  it("writes 'true' for collapsed=true", () => {
    const { api, store } = makeStorage();
    writePersistedCollapsed(api, true);
    expect(store["desgrava:sidebar-collapsed"]).toBe("true");
  });

  it("writes 'false' for collapsed=false", () => {
    const { api, store } = makeStorage({ "desgrava:sidebar-collapsed": "true" });
    writePersistedCollapsed(api, false);
    expect(store["desgrava:sidebar-collapsed"]).toBe("false");
  });

  it("swallows errors from setItem", () => {
    const api = {
      getItem: vi.fn(),
      setItem: vi.fn(() => {
        throw new Error("quota exceeded");
      }),
    };
    expect(() => writePersistedCollapsed(api, true)).not.toThrow();
  });
});

describe("shouldHandleToggleKey", () => {
  it("returns true for a bare '[' on a non-editable target", () => {
    expect(
      shouldHandleToggleKey({
        key: "[",
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        target: null,
      }),
    ).toBe(true);
  });

  it("returns false when key is not '['", () => {
    expect(
      shouldHandleToggleKey({
        key: "]",
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        target: null,
      }),
    ).toBe(false);
  });

  it("returns false when meta/ctrl/alt is held", () => {
    const base = { key: "[", target: null };
    expect(shouldHandleToggleKey({ ...base, metaKey: true, ctrlKey: false, altKey: false })).toBe(
      false,
    );
    expect(shouldHandleToggleKey({ ...base, metaKey: false, ctrlKey: true, altKey: false })).toBe(
      false,
    );
    expect(shouldHandleToggleKey({ ...base, metaKey: false, ctrlKey: false, altKey: true })).toBe(
      false,
    );
  });

  it("returns false when target is INPUT, TEXTAREA, or SELECT", () => {
    for (const tag of ["INPUT", "TEXTAREA", "SELECT"]) {
      const target = { tagName: tag, isContentEditable: false } as unknown as EventTarget;
      expect(
        shouldHandleToggleKey({
          key: "[",
          metaKey: false,
          ctrlKey: false,
          altKey: false,
          target,
        }),
      ).toBe(false);
    }
  });

  it("returns false when target is contentEditable", () => {
    const target = { tagName: "DIV", isContentEditable: true } as unknown as EventTarget;
    expect(
      shouldHandleToggleKey({
        key: "[",
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        target,
      }),
    ).toBe(false);
  });

  it("returns true when target is a non-editable element like a DIV", () => {
    const target = { tagName: "DIV", isContentEditable: false } as unknown as EventTarget;
    expect(
      shouldHandleToggleKey({
        key: "[",
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        target,
      }),
    ).toBe(true);
  });
});
