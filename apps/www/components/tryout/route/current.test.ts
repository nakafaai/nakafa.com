import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Data, Effect } from "effect";
import {
  readCurrentTryoutSection,
  readCurrentTryoutSet,
} from "@/components/tryout/route/current";

const catalogMocks = vi.hoisted(() => ({
  readTryoutSectionAttemptPage: vi.fn(),
  readTryoutSetAttemptPage: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/components/tryout/catalog/server", () => catalogMocks);

const keys = {
  countryKey: "indonesia",
  examKey: "snbt",
  locale: "en",
  setKey: "set-1",
  trackKey: "2027",
} as const;
const running = {
  attemptId: "attempt-1",
  kind: "redirect",
  publicPath: "try-out/indonesia/snbt/2027/set-1",
} as const;
const retained = { attemptId: "attempt-1", kind: "retained" } as const;
/** Stands in for the catalog's own read failure, which these reads pass on. */
class TryoutCatalogReadError extends Data.TaggedError(
  "TryoutCatalogReadError"
)<{
  readonly cause: string;
}> {}
const readFailure = new TryoutCatalogReadError({
  cause: "Convex is unreachable",
});

beforeEach(() => {
  catalogMocks.readTryoutSectionAttemptPage.mockReset();
  catalogMocks.readTryoutSetAttemptPage.mockReset();
});

describe("the attempt a public try-out URL shows", () => {
  it.effect("keeps a missing or finished set attempt as it was read", () =>
    Effect.gen(function* () {
      for (const current of [null, { kind: "current" }]) {
        catalogMocks.readTryoutSetAttemptPage.mockReturnValueOnce(
          Effect.succeed(current)
        );
        expect(yield* readCurrentTryoutSet("token", keys)).toBe(current);
      }
      expect(catalogMocks.readTryoutSetAttemptPage.mock.calls).toEqual([
        ["token", { ...keys, kind: "current" }],
        ["token", { ...keys, kind: "current" }],
      ]);
    })
  );

  it.effect("reads a running set attempt where it continues", () =>
    Effect.gen(function* () {
      catalogMocks.readTryoutSetAttemptPage
        .mockReturnValueOnce(Effect.succeed(running))
        .mockReturnValueOnce(Effect.succeed(null))
        .mockReturnValueOnce(Effect.succeed(running))
        .mockReturnValueOnce(Effect.succeed(retained));
      // The attempt can finish and lose its page between the two reads.
      expect(yield* readCurrentTryoutSet("token", keys)).toBeNull();
      expect(yield* readCurrentTryoutSet("token", keys)).toBe(retained);
      expect(catalogMocks.readTryoutSetAttemptPage).toHaveBeenLastCalledWith(
        "token",
        {
          attemptId: running.attemptId,
          kind: "retained",
          locale: keys.locale,
          publicPath: running.publicPath,
        }
      );
    })
  );

  it.effect("reads a running section attempt where it continues", () =>
    Effect.gen(function* () {
      const section = { ...keys, sectionKey: "quantitative" };
      catalogMocks.readTryoutSectionAttemptPage
        .mockReturnValueOnce(Effect.succeed(null))
        .mockReturnValueOnce(Effect.succeed(running))
        .mockReturnValueOnce(Effect.succeed(retained))
        .mockReturnValueOnce(Effect.succeed(running))
        .mockReturnValueOnce(Effect.succeed(null));
      expect(yield* readCurrentTryoutSection("token", section)).toBeNull();
      expect(yield* readCurrentTryoutSection("token", section)).toBe(retained);
      // The attempt can finish and lose its page between the two reads.
      expect(yield* readCurrentTryoutSection("token", section)).toBeNull();
      const retainedRequest = {
        attemptId: running.attemptId,
        kind: "retained",
        locale: section.locale,
        publicPath: running.publicPath,
      };
      expect(catalogMocks.readTryoutSectionAttemptPage.mock.calls).toEqual([
        ["token", { ...section, kind: "current" }],
        ["token", { ...section, kind: "current" }],
        ["token", retainedRequest],
        ["token", { ...section, kind: "current" }],
        ["token", retainedRequest],
      ]);
    })
  );

  it.effect("passes a failed attempt read on as its typed failure", () =>
    Effect.gen(function* () {
      catalogMocks.readTryoutSetAttemptPage.mockReturnValueOnce(
        Effect.fail(readFailure)
      );
      catalogMocks.readTryoutSectionAttemptPage
        .mockReturnValueOnce(Effect.succeed(running))
        .mockReturnValueOnce(Effect.fail(readFailure));
      expect(yield* Effect.flip(readCurrentTryoutSet("token", keys))).toBe(
        readFailure
      );
      expect(
        yield* Effect.flip(
          readCurrentTryoutSection("token", { ...keys, sectionKey: "verbal" })
        )
      ).toBe(readFailure);
    })
  );
});
