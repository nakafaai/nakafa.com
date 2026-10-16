import { Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { purposes } from "@repo/backend/confect/gateway/purpose";
import { provider } from "@repo/backend/test/gateway";
import { createNinaTest } from "@repo/backend/test/nina";
import { MockLanguageModelV4 } from "ai/test";
import { Array as Arr, MutableList } from "effect";

vi.mock("@repo/backend/confect/gateway/live", async () => ({
  GatewayLive: (await import("@repo/backend/test/gateway")).GatewayTest,
}));

const run = Ref.getFunctionReference(refs.internal.nina.response.run);

/** A turn whose run fails before it answers. */
const failing = () => createNinaTest({ prompt: "Explain a function limit." });

/**
 * The AI SDK reports its own total, step and chunk deadlines through the abort
 * of the stream, naming a timeout as the reason, and never through the error
 * callback. Each test below lets the real SDK timer of one deadline fire and
 * checks that the turn stores a response timeout, so a change in how the SDK
 * reports a deadline fails one of them. The SDK arms the step and chunk timers
 * with `setTimeout`, so the fake clock drives them. The clock advances from
 * inside the model's stream, as in the readiness test of the generation tests:
 * a timer that the test body fires would run outside the action and could not
 * call the backend.
 */
describe("The Nina response run when the AI SDK ends a call at one of its deadlines", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.restoreAllMocks();
    provider.languageModel.mockReset();
    vi.useRealTimers();
  });

  it("stores a response timeout when the provider goes silent for longer than the chunk deadline", async () => {
    provider.languageModel.mockReturnValue(
      new MockLanguageModelV4({
        doStream: () =>
          Promise.resolve({
            stream: new ReadableStream({
              start(controller) {
                controller.enqueue({ type: "stream-start", warnings: [] });
                controller.enqueue({ type: "text-start", id: "answer" });
                controller.enqueue({
                  type: "text-delta",
                  id: "answer",
                  delta: "A limit",
                });
                controller.enqueue({
                  type: "text-delta",
                  id: "answer",
                  delta: " is",
                });
              },
              // The SDK asks for more as it reads the last part above, and it
              // has armed its chunk timer on the one before. The model then
              // says nothing more, for longer than the deadline.
              pull() {
                vi.advanceTimersByTime(purposes.chat.timeout.chunkMs);
                return new Promise<void>(() => undefined);
              },
            }),
          }),
      })
    );
    const f = await failing();
    await f.t.action(run, { turnId: f.turnId });
    const state = await f.inspect();
    expect(state.turn?.state).toMatchObject({
      status: "failed",
      reason: "response-timeout",
    });
    expect(state.user?.credits).toBe(10);
  }, 30_000);

  it("stores a response timeout when a call that never goes quiet outlasts the step deadline", async () => {
    const { chunkMs, stepMs } = purposes.chat.timeout;
    // A word arrives every quarter chunk deadline, so the chunk timer does not
    // fire, and the step timer is the one that fires once the words have taken
    // the whole step. At half the chunk deadline, the chunk timer fired first
    // with the step deadline of 180 seconds, at 157.5 seconds of words.
    const pace = chunkMs / 4;
    let streamedMs = 0;
    provider.languageModel.mockReturnValue(
      new MockLanguageModelV4({
        doStream: ({ abortSignal }) =>
          Promise.resolve({
            stream: new ReadableStream({
              start(controller) {
                controller.enqueue({ type: "stream-start", warnings: [] });
                controller.enqueue({ type: "text-start", id: "answer" });
              },
              pull(controller) {
                // A call that no deadline ended would take words for ever.
                if (streamedMs > stepMs + pace) {
                  controller.error(new Error("No deadline ended the call."));
                  return;
                }
                streamedMs += pace;
                vi.advanceTimersByTime(pace);
                // Once the SDK ended the call it takes no more words.
                if (!abortSignal?.aborted) {
                  controller.enqueue({
                    type: "text-delta",
                    id: "answer",
                    delta: "word ",
                  });
                }
              },
            }),
          }),
      })
    );
    const f = await failing();
    await f.t.action(run, { turnId: f.turnId });
    // The call lived through its whole step, so it was not the chunk timer.
    expect(streamedMs).toBeGreaterThanOrEqual(stepMs);
    const state = await f.inspect();
    expect(state.turn?.state).toMatchObject({
      status: "failed",
      reason: "response-timeout",
    });
    expect(state.user?.credits).toBe(10);
  }, 30_000);

  it("stores a response timeout when the provider goes silent until the total deadline", async () => {
    // Node arms `AbortSignal.timeout`, which the SDK uses for the total
    // deadline, on its own clock, and the fake clock does not move it. So the
    // test takes its place: the SDK arms its total deadline with it as it arms
    // the real one, and the test fires it, with the reason Node gives, once the
    // provider has gone silent.
    const armed = MutableList.make<() => void>();
    const nativeTimeout = AbortSignal.timeout.bind(AbortSignal);
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
      if (ms !== purposes.chat.timeout.totalMs) {
        return nativeTimeout(ms);
      }
      const deadline = new AbortController();
      MutableList.append(armed, () =>
        deadline.abort(
          new DOMException(
            "The operation was aborted due to timeout",
            "TimeoutError"
          )
        )
      );
      return deadline.signal;
    });
    provider.languageModel.mockReturnValue(
      new MockLanguageModelV4({
        doStream: () =>
          Promise.resolve({
            stream: new ReadableStream({
              start(controller) {
                controller.enqueue({ type: "stream-start", warnings: [] });
                controller.enqueue({ type: "text-start", id: "answer" });
                controller.enqueue({
                  type: "text-delta",
                  id: "answer",
                  delta: "A limit",
                });
              },
              pull(controller) {
                if (armed.length === 0) {
                  controller.error(new Error("No total deadline was armed."));
                } else {
                  Arr.forEach(MutableList.toArray(armed), (fire) => fire());
                }
                return new Promise<void>(() => undefined);
              },
            }),
          }),
      })
    );
    const f = await failing();
    await f.t.action(run, { turnId: f.turnId });
    const state = await f.inspect();
    expect(state.turn?.state).toMatchObject({
      status: "failed",
      reason: "response-timeout",
    });
    expect(state.user?.credits).toBe(10);
  }, 30_000);
});
