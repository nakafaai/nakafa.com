import { describe, expect, it } from "@effect/vitest";
import {
  createBacteriaStore,
  shownGeneration,
} from "@repo/design-system/components/contents/mathematics/bacteria/store";

describe("bacteria store", () => {
  it("shows a chosen generation until the card's view is reset", () => {
    const store = createBacteriaStore();
    store.getState().show(3, 0);
    store.getState().pace(2);

    expect(shownGeneration(store.getState(), 0)).toBe(3);
    expect(shownGeneration(store.getState(), 1)).toBe(0);
    expect(store.getState().speed).toBe(2);
  });
});
