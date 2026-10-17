import { expect, it } from "@effect/vitest";
import { Deferred, Effect } from "effect";
import { makeAnswerRetry } from "@/components/ai/chat/retry";

/**
 * The two callbacks of one wait. Each call counts, and releases `done`, so a
 * test can wait until the wait has reported its outcome.
 */
const makeOutcome = Effect.fn("chat.share.test.outcome")(function* () {
  const done = yield* Deferred.make<void>();
  const release = () => Deferred.doneUnsafe(done, Effect.void);
  return {
    answered: vi.fn<() => void>(release),
    done,
    ended: vi.fn<() => void>(release),
  };
});

it.effect("calls answered once when the wait succeeds, and never ended", () =>
  Effect.gen(function* () {
    const retry = makeAnswerRetry();
    const gate = yield* Deferred.make<void>();
    const on = yield* makeOutcome();

    yield* retry.retry(Deferred.await(gate), on);
    yield* Deferred.succeed(gate, undefined);
    yield* Deferred.await(on.done);

    expect(on.answered).toHaveBeenCalledTimes(1);
    expect(on.ended).not.toHaveBeenCalled();
  })
);

it.effect("calls ended once when the wait fails, and never answered", () =>
  Effect.gen(function* () {
    const retry = makeAnswerRetry();
    const gate = yield* Deferred.make<void, string>();
    const on = yield* makeOutcome();

    yield* retry.retry(Deferred.await(gate), on);
    yield* Deferred.fail(gate, "Refused by the test");
    yield* Deferred.await(on.done);

    expect(on.ended).toHaveBeenCalledTimes(1);
    expect(on.answered).not.toHaveBeenCalled();
  })
);

it.effect(
  "a second retry interrupts the first wait, and the second wait still answers",
  () =>
    Effect.gen(function* () {
      const retry = makeAnswerRetry();
      const firstGate = yield* Deferred.make<void>();
      const secondGate = yield* Deferred.make<void>();
      const first = yield* makeOutcome();
      const second = yield* makeOutcome();

      yield* retry.retry(Deferred.await(firstGate), first);
      yield* retry.retry(Deferred.await(secondGate), second);

      // The second retry returns only after the first wait has ended.
      expect(first.ended).toHaveBeenCalledTimes(1);
      expect(first.answered).not.toHaveBeenCalled();

      yield* Deferred.succeed(secondGate, undefined);
      yield* Deferred.await(second.done);

      expect(second.answered).toHaveBeenCalledTimes(1);
      expect(second.ended).not.toHaveBeenCalled();
    })
);

it.effect(
  "dispose interrupts the open wait, which calls ended and never answered",
  () =>
    Effect.gen(function* () {
      const retry = makeAnswerRetry();
      const gate = yield* Deferred.make<void>();
      const on = yield* makeOutcome();

      yield* retry.retry(Deferred.await(gate), on);
      yield* retry.dispose();

      expect(on.ended).toHaveBeenCalledTimes(1);
      expect(on.answered).not.toHaveBeenCalled();
    })
);

it.effect("dispose does nothing when no wait is open", () =>
  Effect.gen(function* () {
    const retry = makeAnswerRetry();
    yield* retry.dispose();

    const gate = yield* Deferred.make<void>();
    const on = yield* makeOutcome();
    yield* retry.retry(Deferred.await(gate), on);
    yield* Deferred.succeed(gate, undefined);
    yield* Deferred.await(on.done);
    yield* retry.dispose();

    expect(on.answered).toHaveBeenCalledTimes(1);
    expect(on.ended).not.toHaveBeenCalled();
  })
);
