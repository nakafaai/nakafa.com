import { expect, it } from "@effect/vitest";
import { Deferred, Effect, Ref } from "effect";
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

/**
 * Stands in for the subscription that each wait holds on the query. `open` counts
 * the subscriptions that are open now. `lastOpenAtStart` is the count of open
 * subscriptions when the latest one started.
 */
const makeSubscriptions = Effect.fn("chat.share.test.subscriptions")(
  function* () {
    const open = yield* Ref.make(0);
    const lastOpenAtStart = yield* Ref.make(0);
    /** Holds one subscription until `gate` settles, and releases it when the scope closes. */
    const subscribe = (gate: Deferred.Deferred<void, string>) =>
      Effect.acquireRelease(
        Effect.gen(function* () {
          const before = yield* Ref.getAndUpdate(open, (count) => count + 1);
          yield* Ref.set(lastOpenAtStart, before);
        }),
        () => Ref.update(open, (count) => count - 1)
      ).pipe(Effect.andThen(Deferred.await(gate)));
    return {
      lastOpenAtStart: () => Ref.get(lastOpenAtStart),
      open: () => Ref.get(open),
      subscribe,
    };
  }
);

it.effect(
  "calls answered once and never ended, and holds the subscription until release",
  () =>
    Effect.gen(function* () {
      const retry = makeAnswerRetry();
      const subs = yield* makeSubscriptions();
      const gate = yield* Deferred.make<void, string>();
      const on = yield* makeOutcome();

      yield* retry.retry(subs.subscribe(gate), on);
      yield* Deferred.succeed(gate, undefined);
      yield* Deferred.await(on.done);
      yield* Effect.yieldNow;

      expect(on.answered).toHaveBeenCalledTimes(1);
      expect(on.ended).not.toHaveBeenCalled();
      // The readers that the answer remounts join this subscription before it ends.
      expect(yield* subs.open()).toBe(1);

      yield* retry.release();
      expect(yield* subs.open()).toBe(0);
    })
);

it.effect("calls ended once when the wait fails, and never answered", () =>
  Effect.gen(function* () {
    const retry = makeAnswerRetry();
    const subs = yield* makeSubscriptions();
    const gate = yield* Deferred.make<void, string>();
    const on = yield* makeOutcome();

    yield* retry.retry(subs.subscribe(gate), on);
    yield* Deferred.fail(gate, "Refused by the test");
    yield* Deferred.await(on.done);
    yield* retry.dispose();

    expect(on.ended).toHaveBeenCalledTimes(1);
    expect(on.answered).not.toHaveBeenCalled();
    expect(yield* subs.open()).toBe(0);
  })
);

it.effect(
  "a second retry replaces the first wait without reporting it, and the second still answers",
  () =>
    Effect.gen(function* () {
      const retry = makeAnswerRetry();
      const subs = yield* makeSubscriptions();
      const firstGate = yield* Deferred.make<void, string>();
      const secondGate = yield* Deferred.make<void, string>();
      const first = yield* makeOutcome();
      const second = yield* makeOutcome();

      yield* retry.retry(subs.subscribe(firstGate), first);
      yield* retry.retry(subs.subscribe(secondGate), second);

      // The first wait ends quietly, so the state its caller keeps stays with the second.
      expect(first.answered).not.toHaveBeenCalled();
      expect(first.ended).not.toHaveBeenCalled();

      yield* Deferred.succeed(secondGate, undefined);
      yield* Deferred.await(second.done);

      expect(second.answered).toHaveBeenCalledTimes(1);
      expect(second.ended).not.toHaveBeenCalled();
      yield* retry.dispose();
    })
);

it.effect(
  "a retry subscribes only after the wait it replaces has released its subscription",
  () =>
    Effect.gen(function* () {
      const retry = makeAnswerRetry();
      const subs = yield* makeSubscriptions();
      const firstGate = yield* Deferred.make<void, string>();
      const secondGate = yield* Deferred.make<void, string>();
      const first = yield* makeOutcome();
      const second = yield* makeOutcome();

      yield* retry.retry(subs.subscribe(firstGate), first);
      yield* retry.retry(subs.subscribe(secondGate), second);

      // The new subscription starts only after the one it replaces has ended.
      expect(yield* subs.lastOpenAtStart()).toBe(0);
      yield* retry.dispose();
    })
);

it.effect(
  "dispose ends a wait that has not answered, which calls ended and never answered",
  () =>
    Effect.gen(function* () {
      const retry = makeAnswerRetry();
      const subs = yield* makeSubscriptions();
      const gate = yield* Deferred.make<void, string>();
      const on = yield* makeOutcome();

      yield* retry.retry(subs.subscribe(gate), on);
      yield* retry.dispose();

      expect(on.ended).toHaveBeenCalledTimes(1);
      expect(on.answered).not.toHaveBeenCalled();
      expect(yield* subs.open()).toBe(0);
    })
);

it.effect("dispose ends an answered wait without calling ended", () =>
  Effect.gen(function* () {
    const retry = makeAnswerRetry();
    const subs = yield* makeSubscriptions();
    const gate = yield* Deferred.make<void, string>();
    const on = yield* makeOutcome();

    yield* retry.retry(subs.subscribe(gate), on);
    yield* Deferred.succeed(gate, undefined);
    yield* Deferred.await(on.done);
    yield* retry.dispose();

    expect(on.answered).toHaveBeenCalledTimes(1);
    expect(on.ended).not.toHaveBeenCalled();
    expect(yield* subs.open()).toBe(0);
  })
);

it.effect("release does nothing while the wait is still pending", () =>
  Effect.gen(function* () {
    const retry = makeAnswerRetry();
    const subs = yield* makeSubscriptions();
    const gate = yield* Deferred.make<void, string>();
    const on = yield* makeOutcome();

    yield* retry.retry(subs.subscribe(gate), on);
    yield* retry.release();
    expect(yield* subs.open()).toBe(1);

    yield* Deferred.succeed(gate, undefined);
    yield* Deferred.await(on.done);
    yield* Effect.yieldNow;

    expect(on.answered).toHaveBeenCalledTimes(1);
    expect(yield* subs.open()).toBe(1);
    yield* retry.dispose();
  })
);

it.effect(
  "release and dispose do nothing when no wait is open, and the next wait still answers",
  () =>
    Effect.gen(function* () {
      const retry = makeAnswerRetry();
      const subs = yield* makeSubscriptions();
      const gate = yield* Deferred.make<void, string>();
      const on = yield* makeOutcome();

      yield* retry.release();
      yield* retry.dispose();
      yield* retry.retry(subs.subscribe(gate), on);
      yield* Deferred.succeed(gate, undefined);
      yield* Deferred.await(on.done);

      expect(on.answered).toHaveBeenCalledTimes(1);
      expect(on.ended).not.toHaveBeenCalled();
      yield* retry.dispose();
    })
);
