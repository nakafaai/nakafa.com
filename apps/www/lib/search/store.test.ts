import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { encodeJsonText } from "@repo/utilities/json";
import { Schema } from "effect";

import { createSearchStore } from "@/lib/search/store";

const STORAGE_KEY = "nakafa-search";
const StoredSearch = Schema.fromJsonString(
  Schema.Struct({
    state: Schema.Record(Schema.String, Schema.Unknown),
    version: Schema.Number,
  })
);

describe("search store", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("latches command-search activation after its first open", () => {
    const store = createSearchStore();

    expect(store.getState().activated).toBe(false);

    store.getState().setOpen(true);
    expect(store.getState().activated).toBe(true);

    store.getState().setOpen(false);
    expect(store.getState().activated).toBe(true);

    store.getState().setQuery("algebra");
    expect(store.getState().query).toBe("algebra");
  });

  it("changes nothing when the query and open state are set to their current values", () => {
    const store = createSearchStore();
    const before = store.getState();
    const listener = vi.fn();
    store.subscribe(listener);

    store.getState().setOpen(false);
    store.getState().setQuery("");

    expect(store.getState()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it("keeps its actions as the same functions across updates", () => {
    const store = createSearchStore();
    const { setOpen, setQuery } = store.getState();

    store.getState().setQuery("algebra");
    store.getState().setOpen(true);

    expect(store.getState().setOpen).toBe(setOpen);
    expect(store.getState().setQuery).toBe(setQuery);
  });

  it("stores every search field in session storage under the search key", () => {
    const store = createSearchStore();

    store.getState().setQuery("algebra");
    store.getState().setOpen(true);

    const stored = Schema.decodeUnknownSync(StoredSearch)(
      sessionStorage.getItem(STORAGE_KEY)
    );
    expect(stored.version).toBe(1);
    expect(stored.state).toEqual({
      activated: true,
      open: true,
      query: "algebra",
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("restores the saved search state from session storage when the store is created", () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      encodeJsonText({
        state: { activated: true, open: false, query: "saved" },
        version: 1,
      })
    );

    const store = createSearchStore();

    expect(store.getState()).toMatchObject({
      activated: true,
      open: false,
      query: "saved",
    });
  });

  it("ignores saved search state from another version", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    sessionStorage.setItem(
      STORAGE_KEY,
      encodeJsonText({
        state: { activated: true, open: true, query: "saved" },
        version: 0,
      })
    );

    const store = createSearchStore();

    expect(store.getState()).toMatchObject({
      activated: false,
      open: false,
      query: "",
    });
  });
});
