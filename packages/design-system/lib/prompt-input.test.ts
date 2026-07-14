import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import {
  PromptInputCompletionError,
  PromptInputSubmitError,
  submitPromptInput,
} from "./prompt-input";
import type { PromptInputFile } from "./prompt-input-files";

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
  it("submits synchronously and applies success state", async () => {
    const onSubmit = vi.fn();
    const onSuccess = vi.fn();

    await Effect.runPromise(
      submitPromptInput({
        event: "submit-event",
        files: [createPromptFile()],
        onSubmit,
        onSuccess,
        text: "Explain this lesson.",
      })
    );

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
  });

  it("awaits asynchronous consumers before applying success state", async () => {
    const order: string[] = [];

    await Effect.runPromise(
      submitPromptInput({
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
      })
    );

    expect(order).toEqual(["submitted", "completed"]);
  });

  it("types synchronous consumer failures", async () => {
    const cause = new Error("Submit failed immediately.");
    const onSuccess = vi.fn();
    const error = await Effect.runPromise(
      submitPromptInput({
        event: "submit-event",
        files: [],
        onSubmit: () => {
          throw cause;
        },
        onSuccess,
        text: "Hello",
      }).pipe(Effect.flip)
    );

    expect(error).toBeInstanceOf(PromptInputSubmitError);
    expect(error.cause).toBe(cause);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("types asynchronous consumer failures", async () => {
    const cause = new Error("Submit promise rejected.");
    const onSuccess = vi.fn();
    const error = await Effect.runPromise(
      submitPromptInput({
        event: "submit-event",
        files: [],
        onSubmit: () => Promise.reject(cause),
        onSuccess,
        text: "Hello",
      }).pipe(Effect.flip)
    );

    expect(error).toBeInstanceOf(PromptInputSubmitError);
    expect(error.cause).toBe(cause);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("types success-state failures after a successful submit", async () => {
    const cause = new Error("Completion state failed.");
    const error = await Effect.runPromise(
      submitPromptInput({
        event: "submit-event",
        files: [],
        onSubmit: vi.fn(),
        onSuccess: () => {
          throw cause;
        },
        text: "Hello",
      }).pipe(Effect.flip)
    );

    expect(error).toBeInstanceOf(PromptInputCompletionError);
    expect(error.cause).toBe(cause);
  });
});
