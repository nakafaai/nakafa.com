import { expect, it } from "@effect/vitest";
import { CapabilityOutputSchema } from "@repo/backend/client/nina/capability";
import {
  countTextTokens,
  NINA_BUDGET,
} from "@repo/backend/confect/nina/budget";
import {
  CAPABILITY_BUDGET,
  ChatStep,
  makeChatStep,
} from "@repo/backend/confect/nina/capability/deadline";
import {
  type CapabilityArtifact,
  specialistResult,
  streamCapability,
} from "@repo/backend/confect/nina/capability/progress";
import { inNewChatStep } from "@repo/backend/test/nina/deadline";
import { NakafaAgentContentRefInputSchema } from "@repo/contents/agent/schema/read";
import {
  Array as Arr,
  Deferred,
  Duration,
  Effect,
  Exit,
  Fiber,
  Logger,
  MutableRef,
  Option,
  Ref,
  Result,
  Schema,
  Stream,
} from "effect";
import { TestClock } from "effect/testing";

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
const options = {
  capability: "deepResearch",
  continuation: "Ask a narrower question.",
} as const;
const cutFirstHalf = /^The first half\n\n.*cut short/su;

it("reports a specialist's answer as partial, and tells Nina why, only when it ended at the output cap or its loop at the step limit with a tool still called", () => {
  expect(specialistResult("A whole answer.", "stop")).toEqual({
    text: "A whole answer.",
  });
  expect(specialistResult("The first half", "length")).toEqual({
    outcome: "partial",
    text: expect.stringMatching(cutFirstHalf),
  });
  expect(specialistResult("The first half", "tool-calls")).toEqual({
    outcome: "partial",
    text: expect.stringContaining("step limit"),
  });
});

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
      ).pipe(Stream.runCollect, inNewChatStep);
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
    ).pipe(Stream.runCollect, inNewChatStep);
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
      Stream.runCollect,
      inNewChatStep
    );
    expect(snapshots).toEqual([
      { text: "", artifacts: [loading] },
      { text: "Finished", artifacts: [loading] },
    ]);
  })
);

const done = {
  ...loading,
  data: { ...loading.data, status: "done" },
} satisfies CapabilityArtifact;
const lost = {
  ...loading,
  id: "search-2",
  data: { ...loading.data, status: "error", error: "Unavailable" },
} satisfies CapabilityArtifact;
const sum = { expression: "2", latex: "2" };
const request = {
  expression: "1 + 1",
  kind: "math",
  operation: "evaluate",
} as const;
const verified = {
  type: "data-math",
  id: "math-1",
  data: {
    input: request,
    kind: "evaluate",
    result: {
      conditions: [],
      input: request,
      items: [],
      kind: "evaluate",
      operation: "evaluate",
      primary: { expression: "1 + 1", latex: "1 + 1" },
      reason: "verified",
      secondary: sum,
      stepStatus: "complete",
      steps: [],
      status: "verified",
    },
    status: "verified",
    summary: "verified",
  },
} satisfies CapabilityArtifact;

it.effect.each([
  [
    "a failed run that loaded nothing stays failed",
    [loading],
    "failed",
    "failed",
  ],
  [
    "a failed run never contradicts loaded sources",
    [done],
    "failed",
    "partial",
  ],
  [
    "a failed run never contradicts a verified calculation",
    [verified],
    "failed",
    "partial",
  ],
  [
    "a run that lost a card beside a loaded one is partial",
    [done, lost],
    undefined,
    "partial",
  ],
  [
    "a run that lost a card beside a verified calculation is partial",
    [verified, lost],
    undefined,
    "partial",
  ],
  [
    "a run that only lost cards is failed, whatever prose it returned",
    [lost],
    undefined,
    "failed",
  ],
  [
    "a run with every card loaded reports no outcome",
    [done, verified],
    undefined,
    undefined,
  ],
  [
    "an empty run that lost a card beside a settled one is partial",
    [done, lost],
    "empty",
    "partial",
  ],
  ["an empty run stays empty beside settled cards", [done], "empty", "empty"],
  [
    "a denied run stays denied whatever its cards",
    [done, lost],
    "denied",
    "denied",
  ],
  ["a stated outcome survives lost evidence", [lost], "empty", "empty"],
] as const)("settles the stored outcome: %s", ([, cards, reported, stored]) =>
  Effect.gen(function* () {
    const snapshots = yield* streamCapability(
      (publish) =>
        Effect.forEach(cards, publish).pipe(
          Effect.as({
            text: "Research evidence",
            ...(reported ? { outcome: reported } : {}),
          })
        ),
      options
    ).pipe(Stream.runCollect, inNewChatStep);
    const final = yield* Schema.decodeEffect(CapabilityOutputSchema)(
      Option.getOrThrow(Arr.last(snapshots))
    );
    expect(final).toEqual({
      artifacts: cards,
      ...(stored ? { outcome: stored } : {}),
      text: "Research evidence",
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
    ).pipe(Stream.runCollect, inNewChatStep, Effect.result);
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
      ).pipe(Stream.take(1), Stream.runDrain, inNewChatStep);
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
      ).pipe(Stream.runDrain, inNewChatStep, Effect.forkScoped);
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
      }).pipe(Stream.runDrain, inNewChatStep, Effect.exit);
      expect(Exit.isFailure(aborted)).toBe(true);
      const result = yield* streamCapability(
        () => Effect.succeed({ text: "Completed" }),
        { ...options, signal: yield* Effect.abortSignal }
      ).pipe(Stream.runCollect, inNewChatStep);
      expect(Arr.last(result)).toEqual(
        Option.some({ text: "Completed", artifacts: [] })
      );
    })
);

const content = {
  content_ref: NakafaAgentContentRefInputSchema.make(
    "https://nakafa.com/en/home"
  ),
};
/** One card of every kind that is still loading, and one that already settled. */
const unfinished = [
  { ...loading, id: "search-loading" },
  {
    type: "data-scrape-url",
    id: "scrape-loading",
    data: { content: "", status: "loading", url: "https://example.com/a" },
  },
  {
    type: "data-nakafa",
    id: "nakafa-loading",
    data: { input: content, kind: "content", status: "loading" },
  },
  {
    type: "data-math",
    id: "math-loading",
    data: { input: request, kind: "evaluate", status: "loading" },
  },
] satisfies CapabilityArtifact[];
const settled = [
  done,
  {
    type: "data-scrape-url",
    id: "scrape-done",
    data: { content: "Text", status: "done", url: "https://example.com/b" },
  },
  {
    type: "data-nakafa",
    id: "nakafa-lost",
    data: {
      error: "Not found.",
      input: content,
      kind: "content",
      status: "error",
    },
  },
  verified,
] satisfies CapabilityArtifact[];

/**
 * Runs a capability that publishes `cards` and then never answers, up to its
 * deadline. Its chat step began `used` before the capability did, as when
 * Nina's own call took that long, and the run is cut with its step. The test
 * clock moves only once the run is waiting.
 */
const cutAtDeadline = (
  cards: readonly CapabilityArtifact[],
  used: Duration.Input = Duration.zero
) =>
  Effect.gen(function* () {
    const step = yield* makeChatStep();
    yield* TestClock.adjust(used);
    const logged = MutableRef.make<readonly unknown[]>([]);
    const waiting = yield* Deferred.make<void>();
    const fiber = yield* Effect.forkChild(
      streamCapability(
        (publish) =>
          Effect.forEach(cards, publish).pipe(
            Effect.andThen(Deferred.succeed(waiting, undefined)),
            Effect.andThen(Effect.never)
          ),
        options
      ).pipe(
        Stream.runCollect,
        Effect.provideService(ChatStep, step),
        Effect.provide(
          Logger.layer([
            Logger.formatStructured.pipe(
              Logger.map(({ message }) =>
                MutableRef.update(logged, Arr.append(message))
              )
            ),
          ])
        )
      )
    );
    yield* Deferred.await(waiting);
    const left = Duration.subtract(
      CAPABILITY_BUDGET,
      Duration.fromInputUnsafe(used)
    );
    yield* TestClock.adjust(Duration.subtract(left, Duration.millis(1)));
    expect(fiber.pollUnsafe()).toBeUndefined();
    yield* TestClock.adjust("1 millis");
    const snapshots = yield* Fiber.join(fiber);
    const final = yield* Schema.decodeEffect(CapabilityOutputSchema)(
      Option.getOrThrow(Arr.last(snapshots))
    );
    return { final, logged: MutableRef.get(logged) };
  });

it.effect.each([
  ["a run that loaded evidence is partial", [done], "partial"],
  ["a run that loaded a calculation is partial", [verified], "partial"],
  ["a run that only has unfinished cards failed", [loading], "failed"],
  ["a run that published nothing failed", [], "failed"],
] as const)("cuts a run at its deadline: %s", ([, cards, outcome]) =>
  Effect.gen(function* () {
    const { final, logged } = yield* cutAtDeadline(cards);
    expect(final.outcome).toBe(outcome);
    expect(final.text).toContain("ran out of time");
    expect(logged).toEqual([
      ["Nina capability ran out of time", { capability: "deepResearch" }],
    ]);
  })
);

it.effect(
  "cuts a run with its chat step, which Nina's own call has already used, not a whole budget after the run began",
  () =>
    Effect.gen(function* () {
      const { final } = yield* cutAtDeadline([done], "25 seconds");
      expect(final.outcome).toBe("partial");
      expect(final.text).toContain("ran out of time");
      expect(final.artifacts).toEqual([done]);
    })
);

it.effect(
  "leaves no card loading when a run is cut, and keeps every card that settled",
  () =>
    Effect.gen(function* () {
      const { final } = yield* cutAtDeadline([...unfinished, ...settled]);
      expect(final.outcome).toBe("partial");
      expect(
        Arr.map(final.artifacts, ({ data, id }) => [id, data.status])
      ).toEqual([
        ["search-loading", "error"],
        ["scrape-loading", "error"],
        ["nakafa-loading", "error"],
        ["math-loading", "error"],
        ["search-1", "done"],
        ["scrape-done", "done"],
        ["nakafa-lost", "error"],
        ["math-1", "verified"],
      ]);
      expect(Arr.drop(final.artifacts, unfinished.length)).toEqual(settled);
      Arr.forEach(Arr.take(final.artifacts, unfinished.length), (card) =>
        expect(card.data).toMatchObject({ error: expect.any(String) })
      );
    })
);

it.effect("does not cut a run that ends within its deadline", () =>
  Effect.gen(function* () {
    const waiting = yield* Deferred.make<void>();
    const fiber = yield* Effect.forkChild(
      streamCapability(
        (publish) =>
          publish(done).pipe(
            Effect.andThen(Deferred.succeed(waiting, undefined)),
            Effect.andThen(Effect.sleep("30 seconds")),
            Effect.as({ text: "Finished in time" })
          ),
        options
      ).pipe(Stream.runCollect, inNewChatStep)
    );
    yield* Deferred.await(waiting);
    yield* TestClock.adjust("30 seconds");
    expect(Arr.last(yield* Fiber.join(fiber))).toEqual(
      Option.some({ artifacts: [done], text: "Finished in time" })
    );
  })
);
