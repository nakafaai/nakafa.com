import { expect, it } from "@effect/vitest";
import { CapabilityOutputSchema } from "@repo/backend/client/nina/capability";
import {
  countTextTokens,
  NINA_BUDGET,
} from "@repo/backend/confect/nina/budget";
import {
  type CapabilityArtifact,
  streamCapability,
} from "@repo/backend/confect/nina/capability/progress";
import {
  Array as Arr,
  Deferred,
  Effect,
  Exit,
  Fiber,
  Option,
  Ref,
  Result,
  Schema,
  Stream,
} from "effect";

const loading = {
  type: "data-web-search",
  id: "search-1",
  data: {
    provider: "firecrawl",
    queries: ["limit"],
    sources: [],
    status: "loading",
  },
} satisfies CapabilityArtifact;
const options = { continuation: "Ask a narrower question." };

it.effect(
  "keeps stable cards in the final output while coalescing progressive snapshots",
  () =>
    Effect.gen(function* () {
      const snapshots = yield* streamCapability(
        (publish) =>
          Effect.gen(function* () {
            yield* publish(loading);
            yield* publish({ ...loading, id: "search-2" });
            yield* publish({
              ...loading,
              data: { ...loading.data, status: "done" },
            });
            return { text: "Verified evidence" };
          }),
        options
      ).pipe(Stream.runCollect);
      expect(Arr.last(snapshots)).toEqual(
        Option.some({
          text: "Verified evidence",
          artifacts: [
            { ...loading, data: { ...loading.data, status: "done" } },
            { ...loading, id: "search-2" },
          ],
        })
      );
    })
);

it.effect("bounds oversized evidence and tells the model how to continue", () =>
  Effect.gen(function* () {
    const snapshots = yield* streamCapability(
      () =>
        Effect.succeed({
          text: "A long lesson paragraph about limits.\n\n".repeat(2000),
        }),
      options
    ).pipe(Stream.runCollect);
    const text = Option.getOrThrow(Arr.last(snapshots)).text;
    expect(countTextTokens(text)).toBeLessThanOrEqual(NINA_BUDGET.evidence);
    expect(text).toContain("Ask a narrower question.");
  })
);

it.effect("emits pending evidence before the provider finishes", () =>
  Effect.gen(function* () {
    const observed = yield* Deferred.make<void>();
    const snapshots = yield* streamCapability(
      (publish) =>
        Effect.gen(function* () {
          yield* publish(loading);
          yield* Deferred.await(observed);
          return { text: "Finished" };
        }),
      options
    ).pipe(
      Stream.tap(() => Deferred.succeed(observed, undefined)),
      Stream.runCollect
    );
    expect(snapshots).toEqual([
      { text: "", artifacts: [loading] },
      { text: "Finished", artifacts: [loading] },
    ]);
  })
);

it.effect("retains gathered steps with a typed specialist failure", () =>
  Effect.gen(function* () {
    const snapshots = yield* streamCapability(
      (publish) =>
        publish(loading).pipe(
          Effect.as({
            text: "Research unavailable",
            failure: "failed" as const,
          })
        ),
      options
    ).pipe(Stream.runCollect);
    const final = yield* Schema.decodeEffect(CapabilityOutputSchema)(
      Option.getOrThrow(Arr.last(snapshots))
    );
    expect(final).toEqual({
      artifacts: [loading],
      failure: "failed",
      text: "Research unavailable",
    });
  })
);

class EvidenceUnavailable extends Schema.TaggedError<EvidenceUnavailable>()(
  "EvidenceUnavailable",
  {}
) {}

it.effect("preserves a typed capability failure after progress", () =>
  Effect.gen(function* () {
    const result = yield* streamCapability(
      (publish) =>
        Effect.gen(function* () {
          yield* publish(loading);
          return yield* new EvidenceUnavailable();
        }),
      options
    ).pipe(Stream.runCollect, Effect.result);
    expect(Result.isFailure(result) && result.failure._tag).toBe(
      "EvidenceUnavailable"
    );
  })
);

it.effect(
  "interrupts provider work when the Agent stops consuming a tool",
  () =>
    Effect.gen(function* () {
      const interrupted = yield* Ref.make(false);
      yield* streamCapability(
        (publish) =>
          publish(loading).pipe(
            Effect.andThen(Effect.never),
            Effect.ensuring(Ref.set(interrupted, true))
          ),
        options
      ).pipe(Stream.take(1), Stream.runDrain);
      expect(yield* Ref.get(interrupted)).toBe(true);
    })
);

it.effect(
  "interrupts in-flight provider work when Agent aborts the tool",
  () => {
    const controller = new AbortController();
    return Effect.gen(function* () {
      const started = yield* Deferred.make<void>();
      const stopped = yield* Ref.make(false);
      const fiber = yield* streamCapability(
        () =>
          Deferred.succeed(started, undefined).pipe(
            Effect.andThen(Effect.never),
            Effect.ensuring(Ref.set(stopped, true))
          ),
        { ...options, signal: controller.signal }
      ).pipe(Stream.runDrain, Effect.forkScoped);
      yield* Deferred.await(started);
      controller.abort();
      expect(Exit.isFailure(yield* Fiber.await(fiber))).toBe(true);
      expect(yield* Ref.get(stopped)).toBe(true);
    });
  }
);

it.effect(
  "honors an already-aborted Agent call and completes live signals normally",
  () =>
    Effect.gen(function* () {
      const aborted = yield* streamCapability(() => Effect.never, {
        ...options,
        signal: AbortSignal.abort(),
      }).pipe(Stream.runDrain, Effect.exit);
      expect(Exit.isFailure(aborted)).toBe(true);
      const result = yield* streamCapability(
        () => Effect.succeed({ text: "Completed" }),
        { ...options, signal: yield* Effect.abortSignal }
      ).pipe(Stream.runCollect);
      expect(Arr.last(result)).toEqual(
        Option.some({ text: "Completed", artifacts: [] })
      );
    })
);
