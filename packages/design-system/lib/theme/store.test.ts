// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  connectThemeStore,
  createThemeStore,
} from "@repo/design-system/lib/theme/store";

/** Stands in for the prefers-color-scheme query and reports when its match changes. */
class SystemQuery extends EventTarget {
  matches: boolean;

  constructor(matches: boolean) {
    super();
    this.matches = matches;
  }

  change(matches: boolean) {
    this.matches = matches;
    this.dispatchEvent(new Event("change"));
  }
}

/** Disconnects the store of the running test, so no earlier store reacts to later events. */
let disconnectRunningStore: (() => void) | undefined;

/** Connects a new store to a system query that matches dark when `systemDark` is true. */
function connectStore(systemDark: boolean) {
  const query = new SystemQuery(systemDark);
  vi.stubGlobal("matchMedia", () => query);
  const store = createThemeStore();
  const disconnect = connectThemeStore(store);
  disconnectRunningStore = disconnect;
  return { disconnect, query, store };
}

/** Dispatches the storage event that another tab causes. */
function storageFromAnotherTab(key: string | null, newValue: string | null) {
  window.dispatchEvent(new StorageEvent("storage", { key, newValue }));
}

/** Counts the transition rules that have not been removed yet. */
function countTransitionRules() {
  return document.head.querySelectorAll("style").length;
}

afterEach(() => {
  disconnectRunningStore?.();
  disconnectRunningStore = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  document.head.replaceChildren();
  document.documentElement.removeAttribute("class");
  document.documentElement.style.removeProperty("color-scheme");
});

describe("createThemeStore", () => {
  it("starts from the system choice under the light appearance that the server renders", () => {
    const state = createThemeStore().getState();

    expect(state.theme).toBe("system");
    expect(state.resolvedTheme).toBe("light");
    expect(state.systemAppearance).toBe("light");
  });
});

describe("connectThemeStore", () => {
  it("reads the stored choice and the system appearance, then applies them to the root", () => {
    localStorage.setItem("theme", "darkmatter");

    const { store } = connectStore(true);

    expect(store.getState().theme).toBe("darkmatter");
    expect(store.getState().resolvedTheme).toBe("darkmatter");
    expect(document.documentElement.classList.contains("darkmatter")).toBe(
      true
    );
    expect(
      document.documentElement.style.getPropertyValue("color-scheme")
    ).toBe("light");
  });

  it("follows the system appearance while the choice is system", () => {
    const { query, store } = connectStore(false);

    query.change(true);

    expect(store.getState().resolvedTheme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(
      document.documentElement.style.getPropertyValue("color-scheme")
    ).toBe("dark");
  });

  it("keeps a concrete choice when the system appearance changes", () => {
    localStorage.setItem("theme", "bean");
    const { query, store } = connectStore(false);

    query.change(true);

    expect(store.getState().theme).toBe("bean");
    expect(store.getState().resolvedTheme).toBe("bean");
  });

  it("treats an unknown stored value as the system choice", () => {
    localStorage.setItem("theme", "not-a-theme");

    const { store } = connectStore(true);

    expect(store.getState().theme).toBe("system");
    expect(store.getState().resolvedTheme).toBe("dark");
  });

  it("follows a choice that another tab stores, and returns to system when storage is cleared", () => {
    const { store } = connectStore(false);

    storageFromAnotherTab("theme", "dark");
    expect(store.getState().theme).toBe("dark");

    storageFromAnotherTab(null, null);
    expect(store.getState().theme).toBe("system");
  });

  it("ignores storage events for other keys", () => {
    const { store } = connectStore(false);

    storageFromAnotherTab("other", "dark");

    expect(store.getState().theme).toBe("system");
  });

  it("writes a switch to storage and applies it to the root", () => {
    const { store } = connectStore(true);

    store.getState().setTheme("light");

    expect(localStorage.getItem("theme")).toBe("light");
    expect(store.getState().resolvedTheme).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    store.getState().setTheme("system");

    expect(localStorage.getItem("theme")).toBe("system");
    expect(store.getState().resolvedTheme).toBe("dark");
  });

  it("keeps a switch for this page when storage refuses reads and writes", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage is blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage is blocked");
    });
    const { store } = connectStore(false);

    expect(store.getState().theme).toBe("system");

    store.getState().setTheme("dark");

    expect(store.getState().resolvedTheme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("turns transitions off until the next frame", () => {
    let nextFrame: FrameRequestCallback | undefined;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      nextFrame = callback;
      return 1;
    });
    const { store } = connectStore(false);
    nextFrame?.(0);

    store.getState().setTheme("dark");

    expect(countTransitionRules()).toBe(1);
    nextFrame?.(0);
    expect(countTransitionRules()).toBe(0);
  });

  it("stops following the system, storage and the root once disconnected", () => {
    const { disconnect, query, store } = connectStore(false);

    disconnect();
    query.change(true);
    storageFromAnotherTab("theme", "dark");

    expect(store.getState().resolvedTheme).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);

    store.getState().setTheme("bean");

    expect(store.getState().resolvedTheme).toBe("bean");
    expect(document.documentElement.classList.contains("light")).toBe(true);
  });
});
