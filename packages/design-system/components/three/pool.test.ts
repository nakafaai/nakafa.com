import { describe, expect, it } from "@effect/vitest";
import {
  createContextPool,
  getSharedContextPool,
} from "@repo/design-system/components/three/pool";

describe("createContextPool", () => {
  it("allocates up to the desktop limit and evicts the least-recently-used off-screen canvas first", () => {
    const pool = createContextPool({
      getLimit: () => 2,
      isMobile: () => false,
    });
    const onEvict = vi.fn<(id: string) => void>();

    expect(pool.acquire("a", () => onEvict("a"))).toBe(true);
    expect(pool.acquire("b", () => onEvict("b"))).toBe(true);
    expect(pool.activeCount()).toBe(2);

    // Mark "b" off-screen while "a" stays near viewport; "b" must be evicted before "a".
    pool.markOffscreen("b");
    expect(pool.hasSlot("b")).toBe(true);

    expect(pool.acquire("c", () => onEvict("c"))).toBe(true);
    expect(onEvict).toHaveBeenCalledTimes(1);
    expect(onEvict).toHaveBeenCalledWith("b");
    expect(pool.hasSlot("a")).toBe(true);
    expect(pool.hasSlot("b")).toBe(false);
    expect(pool.hasSlot("c")).toBe(true);
    expect(pool.activeCount()).toBe(2);
  });

  it("falls back to evicting the oldest near-viewport entry when all active canvases are near viewport", () => {
    const pool = createContextPool({
      getLimit: () => 2,
      isMobile: () => false,
    });
    const onEvictA = vi.fn();
    const onEvictB = vi.fn();
    const onEvictC = vi.fn();

    pool.acquire("a", onEvictA);
    pool.acquire("b", onEvictB);
    // Touch "a" again so "b" becomes least recently used.
    pool.acquire("a", onEvictA);

    pool.acquire("c", onEvictC);
    expect(onEvictB).toHaveBeenCalledTimes(1);
    expect(onEvictA).not.toHaveBeenCalled();
    expect(pool.hasSlot("a")).toBe(true);
    expect(pool.hasSlot("b")).toBe(false);
    expect(pool.hasSlot("c")).toBe(true);
  });

  it("releases off-screen canvases immediately on mobile when another near-viewport canvas is active", () => {
    const pool = createContextPool({
      getLimit: () => 2,
      isMobile: () => true,
    });
    const onEvictA = vi.fn();
    const onEvictB = vi.fn();

    pool.acquire("a", onEvictA);
    // Single canvas scrolling off-screen stays warm when no other scene is visible.
    pool.markOffscreen("a");
    expect(onEvictA).not.toHaveBeenCalled();
    expect(pool.hasSlot("a")).toBe(true);

    // Re-enter viewport and activate a second canvas.
    pool.acquire("a", onEvictA);
    pool.acquire("b", onEvictB);
    pool.markOffscreen("a");
    expect(onEvictA).toHaveBeenCalledTimes(1);
    expect(pool.hasSlot("a")).toBe(false);
    expect(pool.hasSlot("b")).toBe(true);
    expect(pool.activeCount()).toBe(1);
  });

  it("reclaims all off-screen slots via releaseOffscreen while sparing the requested id", () => {
    const pool = createContextPool({
      getLimit: () => 4,
      isMobile: () => false,
    });
    const onEvictA = vi.fn();
    const onEvictB = vi.fn();
    const onEvictC = vi.fn();

    pool.acquire("a", onEvictA);
    pool.acquire("b", onEvictB);
    pool.acquire("c", onEvictC);
    pool.markOffscreen("a");
    pool.markOffscreen("b");

    expect(pool.releaseOffscreen("b")).toBe(1);
    expect(onEvictA).toHaveBeenCalledTimes(1);
    expect(onEvictB).not.toHaveBeenCalled();
    expect(pool.hasSlot("a")).toBe(false);
    expect(pool.hasSlot("b")).toBe(true);
    expect(pool.hasSlot("c")).toBe(true);

    // Second call with no remaining off-screen victims returns 0.
    expect(pool.releaseOffscreen("b")).toBe(0);
    expect(pool.releaseOffscreen()).toBe(1);
    expect(onEvictB).toHaveBeenCalledTimes(1);
    expect(pool.activeCount()).toBe(1);
  });

  it("re-acquires slots cleanly when scrolled back into view and ignores unknown ids", () => {
    const pool = createContextPool({
      getLimit: () => 1,
      isMobile: () => false,
    });
    const onEvictA = vi.fn();
    const onEvictB = vi.fn();

    pool.markOffscreen("missing");
    pool.release("missing");

    pool.acquire("a", onEvictA);
    pool.acquire("b", onEvictB);
    expect(pool.hasSlot("a")).toBe(false);
    expect(pool.hasSlot("b")).toBe(true);

    // Re-acquiring "a" evicts "b" and grants "a" a fresh slot.
    pool.acquire("a", onEvictA);
    expect(onEvictB).toHaveBeenCalledTimes(1);
    expect(pool.hasSlot("a")).toBe(true);
    expect(pool.hasSlot("b")).toBe(false);

    pool.release("a");
    pool.release("b");
    expect(pool.activeCount()).toBe(0);
    expect(pool.store.getState().entries).toEqual({});
  });

  it("promotes a waiting near-viewport canvas when an off-screen canvas leaves or unmounts", () => {
    const pool = createContextPool({
      getLimit: () => 2,
      isMobile: () => false,
    });
    const onEvictA = vi.fn();
    const onEvictB = vi.fn();
    const onEvictC = vi.fn();

    pool.acquire("a", onEvictA);
    pool.acquire("b", onEvictB);
    // Fast scroll jump: "c" acquires before "b" reports off-screen, evicting "a".
    pool.acquire("c", onEvictC);
    expect(pool.hasSlot("a")).toBe(false);
    expect(pool.hasSlot("b")).toBe(true);
    expect(pool.hasSlot("c")).toBe(true);

    // As soon as "b" reports off-screen, "b" yields its slot to waiting on-screen "a".
    pool.markOffscreen("b");
    expect(onEvictB).toHaveBeenCalledTimes(1);
    expect(pool.hasSlot("b")).toBe(false);
    expect(pool.hasSlot("a")).toBe(true);
    expect(pool.hasSlot("c")).toBe(true);
  });

  it("handles a zero or negative limit safely by allowing at least one active canvas", () => {
    const pool = createContextPool({
      getLimit: () => 0,
      isMobile: () => false,
    });
    const onEvictA = vi.fn();

    expect(pool.acquire("a", onEvictA)).toBe(true);
    expect(pool.activeCount()).toBe(1);
  });

  it("returns a stable shared pool instance", () => {
    const first = getSharedContextPool();
    const second = getSharedContextPool();
    expect(first).toBe(second);
  });
});
