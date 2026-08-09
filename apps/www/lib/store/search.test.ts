import { describe, expect, it } from "vitest";

import { createSearchStore } from "@/lib/store/search";

describe("search store", () => {
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
});
