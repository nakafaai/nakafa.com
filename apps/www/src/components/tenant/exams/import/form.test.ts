import type { Ref } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import type exams from "@repo/backend/confect/_generated/refs/exams";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect, Result, Schema } from "effect";
import { importForm } from "@/components/tenant/exams/import/form";

const question = {
  answer: null,
  explanation: "",
  figures: [],
  number: 1,
  options: ["Ya", "Tidak"],
  prompt: "Sudah belajar?",
};
const placedId = Schema.decodeUnknownSync(Id("examQuestions"))("question-1");
const form = {
  id: "form-1",
  mimeType: "application/vnd.google-apps.form",
  name: "Kuis",
};

/** The calls of one import, each answering as a test sets. */
const calls = (
  answers: {
    keyless?: number;
    placed?: Ref.Returns<typeof exams.imports.place>["placed"];
    questions?: readonly (typeof question)[] | null;
  } = {}
) => ({
  pick: Effect.succeedSome(form),
  place: vi.fn(() =>
    Promise.resolve(
      Result.succeed({
        keyless: answers.keyless ?? 0,
        left: 0,
        placed: answers.placed ?? [{ id: placedId, number: 1 }],
      })
    )
  ),
  read: vi.fn(() =>
    Promise.resolve(
      Result.succeed(
        answers.questions === undefined ? [question] : answers.questions
      )
    )
  ),
});

describe("importForm", () => {
  it.effect("places a picked form's questions and says so", () =>
    Effect.gen(function* () {
      const success = vi.spyOn(toast, "success");
      const made = calls();
      yield* importForm(made);
      expect(made.read).toHaveBeenCalledWith("form-1");
      expect(made.place).toHaveBeenCalledWith([question]);
      expect(success).toHaveBeenCalledWith({
        description: "import-done.description",
        title: "import-done.title",
      });
      yield* importForm(calls({ keyless: 1 }));
      expect(success).toHaveBeenCalledWith({
        description: "import-keyless.description",
        title: "import-keyless.title",
      });
      success.mockRestore();
    })
  );

  it.effect("says so when a form holds no question it can place", () =>
    Effect.gen(function* () {
      const info = vi.spyOn(toast, "info");
      yield* importForm(calls({ placed: [] }));
      expect(info).toHaveBeenCalledWith({
        description: "import-empty.description",
        title: "import-empty.title",
      });
      info.mockRestore();
    })
  );

  it.effect(
    "does nothing when the Picker closes, and fails without Drive",
    () =>
      Effect.gen(function* () {
        const closed = calls();
        yield* importForm({ ...closed, pick: Effect.succeedNone });
        expect(closed.read).not.toHaveBeenCalled();
        const missing = yield* Effect.flip(
          importForm(calls({ questions: null }))
        );
        expect(missing._tag).toBe("FormDriveMissing");
      })
  );
});
