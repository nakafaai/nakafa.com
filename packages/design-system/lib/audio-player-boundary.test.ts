import { Effect, Fiber } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AudioPlayerOperationError,
  InvalidAudioPlayerSourceError,
} from "./audio-player";
import { runAudioPlayerProgram } from "./audio-player-boundary";

const { captureExceptionMock } = vi.hoisted(() => ({
  captureExceptionMock: vi.fn(),
}));

vi.mock("@repo/analytics/posthog", () => ({
  captureException: captureExceptionMock,
}));

beforeEach(() => {
  captureExceptionMock.mockClear();
});

describe("audio player boundary", () => {
  it("returns an interruptible fiber for lifecycle ownership", () => {
    let interrupted = false;
    const fiber = runAudioPlayerProgram(
      Effect.never.pipe(
        Effect.ensuring(
          Effect.sync(() => {
            interrupted = true;
          })
        )
      ),
      "audio-player-initializer"
    );

    return Effect.runPromise(
      Effect.gen(function* () {
        yield* Fiber.interrupt(fiber);
        expect(interrupted).toBe(true);
      })
    );
  });

  it("reports operation failures with their operation and source", () => {
    const cause = new Error("Playback failed.");
    const fiber = runAudioPlayerProgram(
      Effect.fail(
        new AudioPlayerOperationError({
          cause,
          message: "Audio player operation failed.",
          operation: "play",
        })
      ),
      "audio-player-button"
    );

    return Effect.runPromise(
      Effect.gen(function* () {
        yield* Fiber.join(fiber);
        expect(captureExceptionMock).toHaveBeenCalledExactlyOnceWith(cause, {
          operation: "play",
          source: "audio-player-button",
        });
      })
    );
  });

  it("reports invalid sources with their item and boundary source", () => {
    const error = new InvalidAudioPlayerSourceError({
      itemId: "lesson-audio",
      message: "Audio source is empty.",
    });
    const fiber = runAudioPlayerProgram(
      Effect.fail(error),
      "audio-player-initializer"
    );

    return Effect.runPromise(
      Effect.gen(function* () {
        yield* Fiber.join(fiber);
        expect(captureExceptionMock).toHaveBeenCalledExactlyOnceWith(error, {
          itemId: "lesson-audio",
          operation: "prepare-item",
          source: "audio-player-initializer",
        });
      })
    );
  });
});
