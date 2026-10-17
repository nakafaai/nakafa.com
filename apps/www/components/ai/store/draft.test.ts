import { afterEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  clearAiDraftText,
  resolveAiDraftText,
  resolveAiOwnerChange,
  restoreRefusedText,
  saveAiDraftText,
} from "@/components/ai/store/draft";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

/** The learner who sent a refused prompt is still the one signed in when it returns. */
const sameLearner = { sentBy: "learner-a", signedInAs: "learner-a" };

/** Reads the saved draft through the resolver's public path, with no new input. */
function readSavedDraft(ownerId: string | null) {
  return resolveAiDraftText({
    ownerId,
    pendingText: "",
    pendingTextChanged: false,
  });
}

describe("ai/store/draft", () => {
  it.effect("saves, reads, and clears the current tab draft", () =>
    Effect.gen(function* () {
      yield* saveAiDraftText("Explain this step", "learner-a");

      expect(yield* readSavedDraft("learner-a")).toBe("Explain this step");

      yield* clearAiDraftText;

      expect(yield* readSavedDraft("learner-a")).toBeNull();
    })
  );

  it.effect(
    "claims an anonymous draft for the account completing authentication",
    () =>
      Effect.gen(function* () {
        yield* saveAiDraftText("Carry this question", null);

        expect(yield* readSavedDraft("learner-a")).toBe("Carry this question");
        expect(yield* readSavedDraft("learner-a")).toBe("Carry this question");
      })
  );

  it.effect("discards a stored draft that is not a draft record", () =>
    Effect.gen(function* () {
      window.sessionStorage.setItem("nakafa-ai-draft", "Legacy question");

      expect(yield* readSavedDraft("learner-a")).toBeNull();
      expect(window.sessionStorage.getItem("nakafa-ai-draft")).toBeNull();
    })
  );

  it.effect("writes text and ownership in one storage record", () =>
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

  it.effect("keeps newer input entered while account ownership resolves", () =>
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
      expect(yield* readSavedDraft("learner-a")).toBe("Newer question");
    })
  );

  it.effect("keeps an intentional empty draft during account resolution", () =>
    Effect.gen(function* () {
      yield* saveAiDraftText("Older question", "learner-a");

      expect(
        yield* resolveAiDraftText({
          ownerId: "learner-a",
          pendingText: "",
          pendingTextChanged: true,
        })
      ).toBe("");
      expect(yield* readSavedDraft("learner-a")).toBeNull();
    })
  );

  it.effect("clears a draft when another account owns it", () =>
    Effect.gen(function* () {
      yield* saveAiDraftText("Private question", "learner-a");

      expect(yield* readSavedDraft("learner-b")).toBeNull();
      expect(yield* readSavedDraft("learner-a")).toBeNull();
    })
  );

  it.effect(
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

        expect(yield* readSavedDraft("learner-a")).toBeNull();

        vi.restoreAllMocks();
        vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
          throw new DOMException("Storage blocked");
        });

        expect(yield* clearAiDraftText).toBeUndefined();
      })
  );

  it.effect("does nothing when rendered without browser storage", () =>
    Effect.gen(function* () {
      vi.stubGlobal("window", undefined);

      expect(yield* saveAiDraftText("Server render", null)).toBeUndefined();
      expect(yield* readSavedDraft(null)).toBeNull();
    })
  );

  it("gives a refused prompt back alone when nothing new was typed", () => {
    expect(
      restoreRefusedText({
        refused: "What is a limit?",
        typed: "",
        ...sameLearner,
      })
    ).toBe("What is a limit?");
    expect(
      restoreRefusedText({
        refused: "What is a limit?",
        typed: "   ",
        ...sameLearner,
      })
    ).toBe("What is a limit?");
    expect(
      restoreRefusedText({
        refused: "What is a limit?",
        typed: "What is a limit? ",
        ...sameLearner,
      })
    ).toBe("What is a limit?");
  });

  it("keeps a refused prompt ahead of what the learner typed meanwhile", () => {
    expect(
      restoreRefusedText({
        refused: "What is a limit?",
        typed: "And a derivative?",
        ...sameLearner,
      })
    ).toBe("What is a limit?\n\nAnd a derivative?");
  });

  it("does not give a refused prompt to another learner, or to nobody after sign-out", () => {
    expect(
      restoreRefusedText({
        refused: "What is a limit?",
        sentBy: "learner-a",
        signedInAs: "learner-b",
        typed: "And a derivative?",
      })
    ).toBe("And a derivative?");
    expect(
      restoreRefusedText({
        refused: "What is a limit?",
        sentBy: "learner-a",
        signedInAs: null,
        typed: "",
      })
    ).toBe("");
  });
});

describe("ai/store/draft owner change", () => {
  it("changes nothing for the first answer of a page, or for the same learner", () => {
    for (const { next, previous } of [
      { next: null, previous: undefined },
      { next: "learner-a", previous: undefined },
      { next: null, previous: null },
      { next: "learner-a", previous: "learner-a" },
    ]) {
      expect(resolveAiOwnerChange(previous, next)).toEqual({
        mustResetDraft: false,
        ownerChanged: false,
      });
    }
  });

  it("ends the session of a visitor who signs in and keeps their draft, text and files", () => {
    expect(resolveAiOwnerChange(null, "learner-a")).toEqual({
      mustResetDraft: false,
      ownerChanged: true,
    });
  });

  it("ends the session and the draft of a learner whose session ends or who another learner replaces", () => {
    for (const next of [null, "learner-b"]) {
      expect(resolveAiOwnerChange("learner-a", next)).toEqual({
        mustResetDraft: true,
        ownerChanged: true,
      });
    }
  });
});
