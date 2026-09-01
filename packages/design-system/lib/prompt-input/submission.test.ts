import { describe, expect, it } from "@effect/vitest";
import type { PromptInputFile } from "@repo/design-system/lib/prompt-input/files";
import {
  PromptInputCompletionError,
  PromptInputSubmitError,
  submitPromptInput,
} from "@repo/design-system/lib/prompt-input/submission";
import { Effect } from "effect";

function createPromptFile(): PromptInputFile {
  return {
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
      const onSubmit = vi.fn();
      const onSuccess = vi.fn();

      yield* submitPromptInput({
        event: "submit-event",
        files: [createPromptFile()],
        onSubmit,
        onSuccess,
        text: "Explain this lesson.",
      });

      expect(onSubmit).toHaveBeenCalledWith(
        {
          files: [
            {
              filename: "lesson.txt",
              mediaType: "text/plain",
              type: "file",
              url: "https://nakafa.test/lesson.txt",
            },
          ],
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

      yield* submitPromptInput({
        event: "submit-event",
        files: [],
        onSubmit: () =>
          Promise.resolve().then(() => {
            order.push("submitted");
          }),
        onSuccess: () => {
          order.push("completed");
        },
        text: "Hello",
      });

      expect(order).toEqual(["submitted", "completed"]);
    })
  );

  it.effect("types synchronous consumer failures", () =>
    Effect.gen(function* () {
      const cause = new Error("Submit failed immediately.");
      const onSuccess = vi.fn();
      const error = yield* submitPromptInput({
        event: "submit-event",
        files: [],
        onSubmit: () => {
          throw cause;
        },
        onSuccess,
        text: "Hello",
      }).pipe(Effect.flip);

      expect(error).toBeInstanceOf(PromptInputSubmitError);
      expect(error.cause).toBe(cause);
      expect(onSuccess).not.toHaveBeenCalled();
    })
  );

  it.effect("types asynchronous consumer failures", () =>
    Effect.gen(function* () {
      const cause = new Error("Submit promise rejected.");
      const onSuccess = vi.fn();
      const error = yield* submitPromptInput({
        event: "submit-event",
        files: [],
        onSubmit: () => Promise.reject(cause),
        onSuccess,
        text: "Hello",
      }).pipe(Effect.flip);

      expect(error).toBeInstanceOf(PromptInputSubmitError);
      expect(error.cause).toBe(cause);
      expect(onSuccess).not.toHaveBeenCalled();
    })
  );

  it.effect("types success-state failures after a successful submit", () =>
    Effect.gen(function* () {
      const cause = new Error("Completion state failed.");
      const error = yield* submitPromptInput({
        event: "submit-event",
        files: [],
        onSubmit: vi.fn(),
        onSuccess: () => {
          throw cause;
        },
        text: "Hello",
      }).pipe(Effect.flip);

      expect(error).toBeInstanceOf(PromptInputCompletionError);
      expect(error.cause).toBe(cause);
    })
  );
});
