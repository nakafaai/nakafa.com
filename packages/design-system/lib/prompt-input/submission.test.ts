import { describe, expect, it } from "@effect/vitest";
import type { PromptInputFile } from "@repo/design-system/lib/prompt-input/files";
import {
  PromptInputCompletionError,
  type PromptInputMessage,
  PromptInputSubmitError,
  submitPromptInput,
} from "@repo/design-system/lib/prompt-input/submission";
import { Effect } from "effect";

function createPromptFile(): PromptInputFile {
  return {
    file: new File(["lesson"], "lesson.txt", { type: "text/plain" }),
    filename: "lesson.txt",
    id: "attachment-1",
    mediaType: "text/plain",
    type: "file",
    url: "https://nakafa.test/lesson.txt",
  };
}

describe("prompt input submission", () => {
  it.effect("submits synchronously and applies success state", () =>
    Effect.gen(function* () {
      const onSubmit = vi.fn(() => true);
      const onSuccess = vi.fn(() => true);

      yield* submitPromptInput(
        { files: [createPromptFile()], text: "Explain this lesson." },
        "submit-event",
        onSubmit,
        onSuccess
      );

      expect(onSubmit).toHaveBeenCalledWith(
        {
          files: [createPromptFile()],
          text: "Explain this lesson.",
        },
        "submit-event"
      );
      expect(onSuccess).toHaveBeenCalledOnce();
    })
  );

  it.effect("awaits asynchronous consumers before applying success state", () =>
    Effect.gen(function* () {
      const order: string[] = [];

      yield* submitPromptInput(
        { files: [], text: "Hello" },
        "submit-event",
        () =>
          Promise.resolve().then(() => {
            order.push("submitted");
            return true;
          }),
        () => {
          order.push("completed");
        }
      );

      expect(order).toEqual(["submitted", "completed"]);
    })
  );

  it.effect("retains original files when a consumer rejects admission", () =>
    Effect.gen(function* () {
      const file = createPromptFile();
      const onSuccess = vi.fn();
      const onSubmit = vi.fn((message: PromptInputMessage) => {
        expect(message.files?.[0]?.file).toBe(file.file);
        return Promise.resolve(false);
      });
      yield* submitPromptInput(
        { files: [file], text: "Hello" },
        "submit-event",
        onSubmit,
        onSuccess
      );

      expect(onSuccess).not.toHaveBeenCalled();
    })
  );

  it.effect("types synchronous consumer failures", () =>
    Effect.gen(function* () {
      const cause = new Error("Submit failed immediately.");
      const onSuccess = vi.fn(() => true);
      const error = yield* submitPromptInput(
        { files: [], text: "Hello" },
        "submit-event",
        () => {
          throw cause;
        },
        onSuccess
      ).pipe(Effect.flip);

      expect(error).toBeInstanceOf(PromptInputSubmitError);
      expect(error.cause).toBe(cause);
      expect(onSuccess).not.toHaveBeenCalled();
    })
  );

  it.effect("types asynchronous consumer failures", () =>
    Effect.gen(function* () {
      const cause = new Error("Submit promise rejected.");
      const onSuccess = vi.fn(() => true);
      const error = yield* submitPromptInput(
        { files: [], text: "Hello" },
        "submit-event",
        () => Promise.reject(cause),
        onSuccess
      ).pipe(Effect.flip);

      expect(error).toBeInstanceOf(PromptInputSubmitError);
      expect(error.cause).toBe(cause);
      expect(onSuccess).not.toHaveBeenCalled();
    })
  );

  it.effect("types success-state failures after a successful submit", () =>
    Effect.gen(function* () {
      const cause = new Error("Completion state failed.");
      const error = yield* submitPromptInput(
        { files: [], text: "Hello" },
        "submit-event",
        vi.fn(() => true),
        () => {
          throw cause;
        }
      ).pipe(Effect.flip);

      expect(error).toBeInstanceOf(PromptInputCompletionError);
      expect(error.cause).toBe(cause);
    })
  );
});
