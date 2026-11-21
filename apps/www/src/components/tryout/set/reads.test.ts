import { beforeEach, describe, expect, it } from "@effect/vitest";
import island from "@repo/backend/confect/_generated/refs/island";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { Duration, Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { setReadArgs, warmSetReads } from "@/components/tryout/set/reads";
import { warmQuery } from "@/lib/convex/warm";

vi.mock("@/lib/convex/warm", () => ({ warmQuery: vi.fn() }));

const set = {
  countryKey: "indonesia",
  examKey: "snbt",
  publicPath: "indonesia/snbt/2027/utbk/set-1",
  setKey: "set-1",
  trackKey: "utbk",
};

const identity = {
  countryKey: "indonesia",
  examKey: "snbt",
  locale: "id",
  setKey: "set-1",
  trackKey: "utbk",
};

describe("setReadArgs", () => {
  it("reads the learner's current attempt, and places it on the board, when the address names none", () => {
    expect(setReadArgs({ attemptId: undefined, locale: "id", set })).toEqual({
      attempt: { request: { ...identity, kind: "current" } },
      board: identity,
      claims: identity,
    });
  });

  it("reads and places the attempt the address names", () => {
    expect(setReadArgs({ attemptId: "attempt-1", locale: "id", set })).toEqual({
      attempt: {
        request: {
          attemptId: "attempt-1",
          kind: "retained",
          locale: "id",
          publicPath: set.publicPath,
        },
      },
      board: { ...identity, attemptId: "attempt-1" },
      claims: identity,
    });
  });
});

describe("warmSetReads", () => {
  beforeEach(() => {
    vi.mocked(warmQuery).mockReset();
  });

  it.effect(
    "warms the attempt, the growth, the Stars and the board at once",
    () =>
      Effect.gen(function* () {
        vi.mocked(warmQuery).mockReturnValue(Effect.succeedNone);
        yield* warmSetReads({ attemptId: undefined, locale: "id", set });
        expect(vi.mocked(warmQuery).mock.calls).toEqual([
          [
            tryouts.queries.attemptPage.getSet,
            { request: { ...identity, kind: "current" } },
          ],
          [island.queries.growth, {}],
          [island.queries.claims, identity],
          [tryouts.queries.ranks.bySet, identity],
        ]);
      })
  );

  it.effect(
    "warms a running attempt's retained page and board when the bare address redirects",
    () =>
      Effect.gen(function* () {
        vi.mocked(warmQuery).mockImplementationOnce(() =>
          Effect.succeedSome({
            attemptId: "attempt-1",
            kind: "redirect",
            publicPath: set.publicPath,
          })
        );
        vi.mocked(warmQuery).mockReturnValue(Effect.succeedNone);
        yield* warmSetReads({ attemptId: undefined, locale: "id", set });
        expect(vi.mocked(warmQuery).mock.calls).toEqual([
          [
            tryouts.queries.attemptPage.getSet,
            { request: { ...identity, kind: "current" } },
          ],
          [island.queries.growth, {}],
          [island.queries.claims, identity],
          [tryouts.queries.ranks.bySet, identity],
          [
            tryouts.queries.attemptPage.getSet,
            {
              request: {
                attemptId: "attempt-1",
                kind: "retained",
                locale: "id",
                publicPath: set.publicPath,
              },
            },
          ],
          [
            tryouts.queries.ranks.bySet,
            { ...identity, attemptId: "attempt-1" },
          ],
        ]);
      })
  );

  it.effect(
    "skips redirect warming when the address already names an attempt",
    () =>
      Effect.gen(function* () {
        vi.mocked(warmQuery).mockReturnValue(Effect.succeedNone);
        yield* warmSetReads({ attemptId: "attempt-1", locale: "id", set });
        expect(vi.mocked(warmQuery).mock.calls).toHaveLength(4);
      })
  );

  it.effect(
    "lets the set open after a second when a read has not answered",
    () =>
      Effect.gen(function* () {
        vi.mocked(warmQuery).mockReturnValue(Effect.never);
        const fiber = yield* Effect.forkChild(
          warmSetReads({ attemptId: undefined, locale: "id", set })
        );
        yield* TestClock.adjust(Duration.millis(999));
        expect(fiber.pollUnsafe()).toBeUndefined();
        yield* TestClock.adjust(Duration.millis(1));
        yield* Fiber.join(fiber);
      })
  );
});
