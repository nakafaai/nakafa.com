import { describe, expect, it } from "@effect/vitest";
import { decideWith } from "@repo/backend/confect/gateway/decide";
import { APICallError } from "ai";
import { Experimental_DecisionMockModelV4 as DecisionMockModel } from "ai/test";
import { Array as Arr, Duration, Effect, Fiber, MutableRef } from "effect";
import { TestClock } from "effect/testing";

type DoDecide = DecisionMockModel["doDecide"];

/** One yes-or-no question and one choice, the shapes a judgment asks. */
const questions = {
  lasting: { type: "boolean", instructions: "Does it last?" },
  topic: {
    type: "choice",
    instructions: "Which topic?",
    criteria: { limits: "Limits", integrals: "Integrals" },
  },
} as const;

/** What a decision model answers for the two questions above. */
const answered = {
  answers: {
    lasting: { type: "boolean" as const, probability: 0.91 },
    topic: { type: "choice" as const, choice: "limits" },
  },
  warnings: [],
};

/** A gateway failure the AI SDK treats as transient. */
const transient = new APICallError({
  isRetryable: true,
  message: "Unavailable",
  requestBodyValues: {},
  statusCode: 503,
  url: "https://ai-gateway.convex.dev/alpha/decisions",
});

/** A decision model whose answers come from `doDecide`, recording its calls. */
function modelOf(doDecide: DoDecide) {
  return new DecisionMockModel({ doDecide });
}

describe("A decision", () => {
  it.effect(
    "answers every question with its typed answer, about the state the caller gave",
    () =>
      Effect.gen(function* () {
        const doDecide = vi.fn<DoDecide>(() => Promise.resolve(answered));
        const answers = yield* decideWith(
          modelOf(doDecide),
          "Kelas 12 IPA.",
          questions
        );
        expect(answers).toEqual(answered.answers);
        expect(doDecide).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({
            questions,
            state: [{ type: "text", text: "Kelas 12 IPA." }],
          })
        );
      })
  );

  it.effect(
    "retries a transient failure after the SDK's backoff, and answers",
    () =>
      Effect.gen(function* () {
        // The backoff is the AI SDK's own timer, which the test advances.
        vi.useFakeTimers();
        const doDecide = vi
          .fn<DoDecide>()
          .mockRejectedValueOnce(transient)
          .mockResolvedValueOnce(answered);
        const fiber = yield* Effect.forkChild(
          decideWith(modelOf(doDecide), "Kelas 12 IPA.", questions)
        );
        yield* Effect.promise(() => vi.advanceTimersByTimeAsync(2000));
        expect(yield* Fiber.join(fiber)).toEqual(answered.answers);
        expect(doDecide).toHaveBeenCalledTimes(2);
      })
  );

  it.effect(
    "stops after two retries and reports the failure of the last attempt",
    () =>
      Effect.gen(function* () {
        vi.useFakeTimers();
        const doDecide = vi.fn<DoDecide>().mockRejectedValue(transient);
        const fiber = yield* Effect.forkChild(
          Effect.flip(decideWith(modelOf(doDecide), "Kelas 12 IPA.", questions))
        );
        yield* Effect.promise(() => vi.advanceTimersByTimeAsync(6000));
        expect(yield* Fiber.join(fiber)).toMatchObject({
          _tag: "GatewayFailure",
          reason: "unavailable",
          retryable: true,
          status: 503,
        });
        expect(doDecide).toHaveBeenCalledTimes(3);
      })
  );

  it.effect("does not retry a failure that no second attempt can fix", () =>
    Effect.gen(function* () {
      const doDecide = vi.fn<DoDecide>(() =>
        Promise.reject(
          new APICallError({
            data: { error: { code: "unsupported_parameter" } },
            isRetryable: false,
            message: "Rejected",
            requestBodyValues: {},
            statusCode: 400,
            url: "https://ai-gateway.convex.dev/alpha/decisions",
          })
        )
      );
      const failure = yield* Effect.flip(
        decideWith(modelOf(doDecide), "Kelas 12 IPA.", questions)
      );
      expect(failure).toMatchObject({
        _tag: "GatewayFailure",
        reason: "invalid",
        status: 400,
        type: "unsupported_parameter",
      });
      expect(doDecide).toHaveBeenCalledOnce();
    })
  );

  it.effect(
    "fails when the model refuses a question, and keeps no answer",
    () =>
      Effect.gen(function* () {
        const failure = yield* Effect.flip(
          decideWith(
            modelOf(() =>
              Promise.resolve({
                answers: {
                  lasting: { type: "refusal" as const },
                  topic: { type: "choice" as const, choice: "limits" },
                },
                warnings: [],
              })
            ),
            "Kelas 12 IPA.",
            questions
          )
        );
        expect(failure).toMatchObject({
          _tag: "GatewayFailure",
          reason: "unknown",
        });
      })
  );

  it.effect(
    "ends at its deadline as a timeout and aborts the request that is still open",
    () =>
      Effect.gen(function* () {
        const signals = MutableRef.make<readonly AbortSignal[]>([]);
        const hung = modelOf(({ abortSignal }) => {
          if (abortSignal) {
            MutableRef.update(signals, Arr.append(abortSignal));
          }
          return new Promise(() => undefined);
        });
        const fiber = yield* Effect.forkChild(
          Effect.flip(decideWith(hung, "Kelas 12 IPA.", questions))
        );
        yield* TestClock.adjust(Duration.seconds(10));
        expect(yield* Fiber.join(fiber)).toMatchObject({
          _tag: "GatewayFailure",
          reason: "timeout",
        });
        const [signal, ...others] = MutableRef.get(signals);
        expect(others).toEqual([]);
        expect(signal?.aborted).toBe(true);
      })
  );
});
