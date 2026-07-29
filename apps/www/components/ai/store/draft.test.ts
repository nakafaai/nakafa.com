import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearAiDraftText,
  readAiDraftText,
  saveAiDraftText,
} from "@/components/ai/store/draft";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

describe("ai/store/draft", () => {
  it("saves, reads, and clears the current tab draft", () => {
    Effect.runSync(saveAiDraftText("Explain this step"));

    expect(Effect.runSync(readAiDraftText())).toBe("Explain this step");

    Effect.runSync(clearAiDraftText);

    expect(Effect.runSync(readAiDraftText())).toBeNull();
  });

  it("keeps draft persistence best effort when storage rejects access", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage blocked");
    });

    expect(() => Effect.runSync(saveAiDraftText("Keep typing"))).not.toThrow();

    vi.restoreAllMocks();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage blocked");
    });

    expect(Effect.runSync(readAiDraftText())).toBeNull();

    vi.restoreAllMocks();
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("Storage blocked");
    });

    expect(() => Effect.runSync(clearAiDraftText)).not.toThrow();
  });

  it("does nothing when rendered without browser storage", () => {
    vi.stubGlobal("window", undefined);

    expect(() =>
      Effect.runSync(saveAiDraftText("Server render"))
    ).not.toThrow();
    expect(Effect.runSync(readAiDraftText())).toBeNull();
  });
});
