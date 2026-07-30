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

  it("discards a legacy tab draft without atomic ownership", () => {
    window.sessionStorage.setItem("nakafa-ai-draft", "Legacy question");

    expect(Effect.runSync(readAiDraftText("learner-a"))).toBeNull();
    expect(window.sessionStorage.getItem("nakafa-ai-draft")).toBeNull();
  });

  it("writes text and ownership in one storage record", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    Effect.runSync(saveAiDraftText("One record", "learner-a"));

    expect(setItem).toHaveBeenCalledOnce();
    expect(setItem).toHaveBeenCalledWith(
      "nakafa-ai-draft",
      '{"owner":"learner-a","text":"One record"}'
    );
  });

  it("keeps newer input entered while account ownership resolves", () => {
    Effect.runSync(saveAiDraftText("Older question", "learner-a"));

    expect(
      Effect.runSync(
        resolveAiDraftText({
          ownerId: "learner-a",
          pendingText: "",
          pendingTextChanged: false,
        })
      )
    ).toBe("Older question");
    expect(
      Effect.runSync(
        resolveAiDraftText({
          ownerId: "learner-a",
          pendingText: "Newer question",
          pendingTextChanged: true,
        })
      )
    ).toBe("Newer question");
    expect(Effect.runSync(readAiDraftText("learner-a"))).toBe("Newer question");
  });

  it("keeps an intentional empty draft during account resolution", () => {
    Effect.runSync(saveAiDraftText("Older question", "learner-a"));

    expect(
      Effect.runSync(
        resolveAiDraftText({
          ownerId: "learner-a",
          pendingText: "",
          pendingTextChanged: true,
        })
      )
    ).toBe("");
    expect(Effect.runSync(readAiDraftText("learner-a"))).toBeNull();
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
