import { afterEach, describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";
import { vi } from "vitest";
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
  it.live("saves, reads, and clears the current tab draft", () =>
    Effect.gen(function* () {
      yield* saveAiDraftText("Explain this step", "learner-a");

      expect(yield* readAiDraftText("learner-a")).toBe("Explain this step");

      yield* clearAiDraftText;

      expect(yield* readAiDraftText("learner-a")).toBeNull();
    })
  );

  it.live(
    "claims an anonymous draft for the account completing authentication",
    () =>
      Effect.gen(function* () {
        yield* saveAiDraftText("Carry this question", null);

        expect(yield* readAiDraftText("learner-a")).toBe("Carry this question");
        expect(yield* readAiDraftText("learner-a")).toBe("Carry this question");
      })
  );

  it.live("discards a legacy tab draft without atomic ownership", () =>
    Effect.gen(function* () {
      window.sessionStorage.setItem("nakafa-ai-draft", "Legacy question");

      expect(yield* readAiDraftText("learner-a")).toBeNull();
      expect(window.sessionStorage.getItem("nakafa-ai-draft")).toBeNull();
    })
  );

  it.live("writes text and ownership in one storage record", () =>
    Effect.gen(function* () {
      const setItem = vi.spyOn(Storage.prototype, "setItem");

      yield* saveAiDraftText("One record", "learner-a");

      expect(setItem).toHaveBeenCalledOnce();
      expect(setItem).toHaveBeenCalledWith(
        "nakafa-ai-draft",
        '{"owner":"learner-a","text":"One record"}'
      );
    })
  );

  it.live("keeps newer input entered while account ownership resolves", () =>
    Effect.gen(function* () {
      yield* saveAiDraftText("Older question", "learner-a");

      expect(
        yield* resolveAiDraftText({
          ownerId: "learner-a",
          pendingText: "",
          pendingTextChanged: false,
        })
      ).toBe("Older question");
      expect(
        yield* resolveAiDraftText({
          ownerId: "learner-a",
          pendingText: "Newer question",
          pendingTextChanged: true,
        })
      ).toBe("Newer question");
      expect(yield* readAiDraftText("learner-a")).toBe("Newer question");
    })
  );

  it.live("keeps an intentional empty draft during account resolution", () =>
    Effect.gen(function* () {
      yield* saveAiDraftText("Older question", "learner-a");

      expect(
        yield* resolveAiDraftText({
          ownerId: "learner-a",
          pendingText: "",
          pendingTextChanged: true,
        })
      ).toBe("");
      expect(yield* readAiDraftText("learner-a")).toBeNull();
    })
  );

  it.live("clears a draft when another account owns it", () =>
    Effect.gen(function* () {
      yield* saveAiDraftText("Private question", "learner-a");

      expect(yield* readAiDraftText("learner-b")).toBeNull();
      expect(yield* readAiDraftText("learner-a")).toBeNull();
    })
  );

  it.live(
    "keeps draft persistence best effort when storage rejects access",
    () =>
      Effect.gen(function* () {
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
          throw new DOMException("Storage blocked");
        });

        expect(
          yield* saveAiDraftText("Keep typing", "learner-a")
        ).toBeUndefined();

        vi.restoreAllMocks();
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
          throw new DOMException("Storage blocked");
        });

        expect(yield* readAiDraftText("learner-a")).toBeNull();

        vi.restoreAllMocks();
        vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
          throw new DOMException("Storage blocked");
        });

        expect(yield* clearAiDraftText).toBeUndefined();
      })
  );

  it.live("does nothing when rendered without browser storage", () =>
    Effect.gen(function* () {
      vi.stubGlobal("window", undefined);

      expect(yield* saveAiDraftText("Server render", null)).toBeUndefined();
      expect(yield* readAiDraftText(null)).toBeNull();
    })
  );
});
