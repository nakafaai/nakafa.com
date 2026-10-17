import { describe, expect, it } from "@effect/vitest";
import type {
  PromptInputFile,
  PromptInputRefusal,
} from "@repo/design-system/lib/prompt-input/files";
import {
  PromptInputCompletionError,
  type PromptInputMessage,
  PromptInputSubmitError,
  submitPromptInput,
} from "@repo/design-system/lib/prompt-input/submission";
import { Effect, MutableList } from "effect";

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

function createRefusal(): PromptInputRefusal {
  return { code: "accept", id: "refusal-1", name: "essay.docx" };
}

describe("prompt input submission", () => {
  it.effect("submits synchronously and applies success state", () =>
    Effect.gen(function* () {
      const onSubmit = vi.fn(() => true);
      const onSuccess = vi.fn(() => true);

      yield* submitPromptInput({
        dismissRefusals: vi.fn(),
        event: "submit-event",
        files: [createPromptFile()],
        onSubmit,
        onSuccess,
        refusals: [],
        text: "Explain this lesson.",
      });

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
      const order = MutableList.make<string>();

      yield* submitPromptInput({
        dismissRefusals: vi.fn(),
        event: "submit-event",
        files: [],
        onSubmit: () =>
          Promise.resolve().then(() => {
            MutableList.append(order, "submitted");
            return true;
          }),
        onSuccess: () => {
          MutableList.append(order, "completed");
        },
        refusals: [],
        text: "Hello",
      });

      expect(MutableList.toArray(order)).toEqual(["submitted", "completed"]);
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
      yield* submitPromptInput({
        dismissRefusals: vi.fn(),
        event: "submit-event",
        files: [file],
        onSubmit,
        onSuccess,
        refusals: [],
        text: "Hello",
      });

      expect(onSuccess).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "takes the refusals of the press when the consumer admits the message",
    () =>
      Effect.gen(function* () {
        const dismissRefusals = vi.fn();
        const onSuccess = vi.fn();

        yield* submitPromptInput({
          dismissRefusals,
          event: "submit-event",
          files: [createPromptFile()],
          onSubmit: () => true,
          onSuccess,
          refusals: [createRefusal()],
          text: "Explain this lesson.",
        });

        expect(dismissRefusals).toHaveBeenCalledWith([createRefusal()]);
        expect(onSuccess).toHaveBeenCalledOnce();
      })
  );

  it.effect(
    "takes the refusals of the press when the consumer refuses the message",
    () =>
      Effect.gen(function* () {
        const dismissRefusals = vi.fn();
        const onSuccess = vi.fn();

        yield* submitPromptInput({
          dismissRefusals,
          event: "submit-event",
          files: [createPromptFile()],
          onSubmit: () => Promise.resolve(false),
          onSuccess,
          refusals: [createRefusal()],
          text: "Explain this lesson.",
        });

        expect(dismissRefusals).toHaveBeenCalledWith([createRefusal()]);
        expect(onSuccess).not.toHaveBeenCalled();
      })
  );

  it.effect("types synchronous consumer failures", () =>
    Effect.gen(function* () {
      const cause = new Error("Submit failed immediately.");
      const onSuccess = vi.fn(() => true);
      const error = yield* submitPromptInput({
        dismissRefusals: vi.fn(),
        event: "submit-event",
        files: [],
        onSubmit: () => {
          throw cause;
        },
        onSuccess,
        refusals: [],
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
      const onSuccess = vi.fn(() => true);
      const error = yield* submitPromptInput({
        dismissRefusals: vi.fn(),
        event: "submit-event",
        files: [],
        onSubmit: () => Promise.reject(cause),
        onSuccess,
        refusals: [],
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
        dismissRefusals: vi.fn(),
        event: "submit-event",
        files: [],
        onSubmit: vi.fn(() => true),
        onSuccess: () => {
          throw cause;
        },
        refusals: [],
        text: "Hello",
      }).pipe(Effect.flip);

      expect(error).toBeInstanceOf(PromptInputCompletionError);
      expect(error.cause).toBe(cause);
    })
  );
});
