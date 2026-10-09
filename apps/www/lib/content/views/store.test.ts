import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { encodeJsonText } from "@repo/utilities/json";
import { DateTime, Record as Rec, Schema } from "effect";
import { createContentViewsStore } from "@/lib/content/views/store";

const STORAGE_KEY = "nakafa-content-views";
const SESSION_TTL = 30 * 60 * 1000;
const viewedAt = DateTime.toDateUtc(
  DateTime.makeUnsafe("2026-10-09T08:00:00Z")
);
const key = "user:learner-1:id:asset:id:material:mathematics:algebra:linear";
const otherKey = "anonymous:id:untracked:canonical::";
const StoredViews = Schema.fromJsonString(
  Schema.Struct({
    state: Schema.Record(Schema.String, Schema.Unknown),
    version: Schema.Finite,
  })
);

describe("content views store", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(viewedAt);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("treats a key as viewed until the session window closes", () => {
    const store = createContentViewsStore();
    expect(store.getState().isViewed(key)).toBe(false);

    store.getState().markAsViewed(key);

    expect(store.getState().isViewed(key)).toBe(true);
    expect(store.getState().isViewed(otherKey)).toBe(false);

    vi.setSystemTime(viewedAt.getTime() + SESSION_TTL - 1);
    expect(store.getState().isViewed(key)).toBe(true);

    vi.setSystemTime(viewedAt.getTime() + SESSION_TTL);
    expect(store.getState().isViewed(key)).toBe(false);
  });

  it("records a key again once the session window has closed", () => {
    const store = createContentViewsStore();
    store.getState().markAsViewed(key);

    const reviewedAt = DateTime.toDateUtc(
      DateTime.makeUnsafe(viewedAt.getTime() + SESSION_TTL)
    );
    vi.setSystemTime(reviewedAt);
    expect(store.getState().isViewed(key)).toBe(false);

    store.getState().markAsViewed(key);

    expect(store.getState().viewedSlugs[key]).toBe(reviewedAt.getTime());
    expect(store.getState().isViewed(key)).toBe(true);
  });

  it("keeps its actions as the same functions across updates", () => {
    const store = createContentViewsStore();
    const { isViewed, markAsViewed } = store.getState();

    store.getState().markAsViewed(key);

    expect(store.getState().isViewed).toBe(isViewed);
    expect(store.getState().markAsViewed).toBe(markAsViewed);
  });

  it("changes nothing when the same key is marked again in the same millisecond", () => {
    const store = createContentViewsStore();
    store.getState().markAsViewed(key);
    const before = store.getState();
    const listener = vi.fn();
    store.subscribe(listener);

    store.getState().markAsViewed(key);

    expect(store.getState()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it("persists the viewed keys in local storage under the content views key", () => {
    const store = createContentViewsStore();

    store.getState().markAsViewed(key);

    const stored = Schema.decodeUnknownSync(StoredViews)(
      localStorage.getItem(STORAGE_KEY)
    );
    expect(stored.version).toBe(1);
    expect(Rec.keys(stored.state)).toEqual(["viewedSlugs"]);
    expect(stored.state.viewedSlugs).toEqual({ [key]: viewedAt.getTime() });
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("restores viewed keys from local storage when the store is created", () => {
    localStorage.setItem(
      STORAGE_KEY,
      encodeJsonText({
        state: { viewedSlugs: { [key]: viewedAt.getTime() } },
        version: 1,
      })
    );

    const store = createContentViewsStore();

    expect(store.getState().isViewed(key)).toBe(true);
    expect(store.getState().isViewed(otherKey)).toBe(false);
  });

  it("ignores stored views from another version", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    localStorage.setItem(
      STORAGE_KEY,
      encodeJsonText({
        state: { viewedSlugs: { [key]: viewedAt.getTime() } },
        version: 0,
      })
    );

    const store = createContentViewsStore();

    expect(store.getState().viewedSlugs).toEqual({});
    expect(store.getState().isViewed(key)).toBe(false);
  });
});
