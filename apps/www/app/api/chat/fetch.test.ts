import { describe, expect, it } from "vitest";
import { createPageFetchState } from "@/app/api/chat/fetch";

describe("app/api/chat/fetch", () => {
  it("lets a repaired Nakafa call consume the only current-page fetch", () => {
    const pageFetch = createPageFetchState(true);

    expect(pageFetch.reserveForRepair()).toBe(true);
    expect(pageFetch.consumeForTool()).toBe(true);
    expect(pageFetch.reserveForRepair()).toBe(false);
    expect(pageFetch.consumeForTool()).toBe(false);
  });

  it("lets the first normal Nakafa execution claim current-page fetch once", () => {
    const pageFetch = createPageFetchState(true);

    expect(pageFetch.consumeForTool()).toBe(true);
    expect(pageFetch.reserveForRepair()).toBe(false);
    expect(pageFetch.consumeForTool()).toBe(false);
  });
});
