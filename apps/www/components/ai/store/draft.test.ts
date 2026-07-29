import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearAiDraftText,
  readAiDraftText,
  resolveAiDraftText,
  saveAiDraftText,
} from "@/components/ai/store/draft";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

describe("ai/store/draft", () => {
  it("saves, reads, and clears the current tab draft", () => {
    Effect.runSync(saveAiDraftText("Explain this step", "learner-a"));

    expect(Effect.runSync(readAiDraftText("learner-a"))).toBe(
      "Explain this step"
    );

    Effect.runSync(clearAiDraftText);

    expect(Effect.runSync(readAiDraftText("learner-a"))).toBeNull();
  });

  it("claims an anonymous draft for the account completing authentication", () => {
    Effect.runSync(saveAiDraftText("Carry this question", null));

    expect(Effect.runSync(readAiDraftText("learner-a"))).toBe(
      "Carry this question"
    );
    expect(Effect.runSync(readAiDraftText("learner-a"))).toBe(
      "Carry this question"
    );
  });

  it("claims a legacy tab draft without recorded ownership", () => {
    window.sessionStorage.setItem("nakafa-ai-draft", "Legacy question");

    expect(Effect.runSync(readAiDraftText("learner-a"))).toBe(
      "Legacy question"
    );
  });

  it("keeps newer input entered while account ownership resolves", () => {
    Effect.runSync(saveAiDraftText("Older question", "learner-a"));

    expect(Effect.runSync(resolveAiDraftText("", "learner-a"))).toBe(
      "Older question"
    );
    expect(
      Effect.runSync(resolveAiDraftText("Newer question", "learner-a"))
    ).toBe("Newer question");
    expect(Effect.runSync(readAiDraftText("learner-a"))).toBe("Newer question");
  });

  it("clears a draft when another account owns it", () => {
    Effect.runSync(saveAiDraftText("Private question", "learner-a"));

    expect(Effect.runSync(readAiDraftText("learner-b"))).toBeNull();
    expect(Effect.runSync(readAiDraftText("learner-a"))).toBeNull();
  });

  it("keeps draft persistence best effort when storage rejects access", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage blocked");
    });

    expect(() =>
      Effect.runSync(saveAiDraftText("Keep typing", "learner-a"))
    ).not.toThrow();

    vi.restoreAllMocks();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage blocked");
    });

    expect(Effect.runSync(readAiDraftText("learner-a"))).toBeNull();

    vi.restoreAllMocks();
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("Storage blocked");
    });

    expect(() => Effect.runSync(clearAiDraftText)).not.toThrow();
  });

  it("does nothing when rendered without browser storage", () => {
    vi.stubGlobal("window", undefined);

    expect(() =>
      Effect.runSync(saveAiDraftText("Server render", null))
    ).not.toThrow();
    expect(Effect.runSync(readAiDraftText(null))).toBeNull();
  });
});
