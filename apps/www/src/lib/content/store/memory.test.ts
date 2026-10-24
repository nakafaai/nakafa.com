// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { makeMemoryStore } from "@/lib/content/store/memory";

const LARGE_TEXT = "x".repeat(3_000_000);

describe("memory store", () => {
  it("answers a value until its lifetime ends, then forgets it", () => {
    const store = makeMemoryStore();
    store.set("key", "value", { expiresAt: 100, now: 0, tags: [] });

    expect(store.get("key", 99)).toMatchObject({ value: "value" });
    expect(store.get("key", 100)._tag).toBe("None");
    expect(store.get("key", 0)._tag).toBe("None");
  });

  it("replaces the value under a key", () => {
    const store = makeMemoryStore();
    store.set("key", "first", { expiresAt: 100, now: 0, tags: [] });
    store.set("key", "second", { expiresAt: 100, now: 0, tags: [] });

    expect(store.get("key", 1)).toMatchObject({ value: "second" });
  });

  it("drops every entry that carries a tag and keeps the others", () => {
    const store = makeMemoryStore();
    store.set("tagged", 1, { expiresAt: 100, now: 0, tags: ["pointer"] });
    store.set("kept", 2, { expiresAt: 100, now: 0, tags: ["release"] });

    store.expireTag("pointer");

    expect(store.get("tagged", 1)._tag).toBe("None");
    expect(store.get("kept", 1)).toMatchObject({ value: 2 });
  });

  it("keeps the store within its byte budget by dropping the surplus", () => {
    const store = makeMemoryStore();
    for (const key of ["a", "b", "c", "d", "e", "f", "g"]) {
      store.set(key, LARGE_TEXT, { expiresAt: 100, now: 0, tags: [] });
    }

    const kept = Arr.filter(
      ["a", "b", "c", "d", "e", "f", "g"],
      (key) => store.get(key, 1)._tag === "Some"
    );
    expect(kept.length).toBeLessThan(7);
    expect(kept.length).toBeGreaterThan(0);
  });

  it("drops the entries whose lifetime ended when another value is stored", () => {
    const store = makeMemoryStore();
    store.set("old", 1, { expiresAt: 10, now: 0, tags: [] });
    store.set("new", 2, { expiresAt: 100, now: 20, tags: [] });

    expect(store.get("old", 0)._tag).toBe("None");
    expect(store.get("new", 20)).toMatchObject({ value: 2 });
  });
});
