// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { isNotFound } from "@tanstack/react-router";
import { ConvexError } from "convex/values";
import { Cause, Effect, Exit, Schema } from "effect";
import { PreloadFailed } from "@/lib/data/preload.server";
import { readOptional, readRequired } from "@/lib/data/read.server";

/** The calls that the Convex HTTP client receives, as doubles. */
const convex = vi.hoisted(() => ({
  query: vi.fn<(reference: unknown, args: unknown) => Promise<unknown>>(),
}));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    query(reference: unknown, args: unknown) {
      return convex.query(reference, args);
    }
    setAuth() {
      // The token is not what these reads check.
    }
  },
}));

/** The exception reporter that a real failure of an optional part calls. */
const analytics = vi.hoisted(() => ({
  captureServerExceptionSafely:
    vi.fn<(error: unknown, properties: unknown) => Effect.Effect<void>>(),
}));

vi.mock("@/lib/analytics/server", () => ({
  captureServerExceptionSafely: analytics.captureServerExceptionSafely,
}));

beforeEach(() => {
  analytics.captureServerExceptionSafely.mockReturnValue(Effect.void);
});

process.env.VITE_CONVEX_URL = "https://example.convex.cloud";

/** A real public query reference, whose value is a list of learning rows. */
const ref = refs.public.contents.queries.recent.getRecentlyViewed;

/** A real query that declares the refusal of a viewer without access. */
const openExam = exams.exams.open;
const openArgs = {
  examId: Schema.decodeUnknownSync(Id("exams"))("exam-1"),
  slug: Schema.decodeSync(TenantSlug)("harapan"),
};

/** The error that Convex carries for a refusal the query declares, with its encoded fields. */
const refusal = () =>
  new ConvexError(
    Schema.encodeSync(AccessDenied)(
      new AccessDenied({ action: "exam.view", reason: "resource" })
    )
  );

describe("required and optional preloads", () => {
  it.effect("ends a page whose required read is refused as not found", () =>
    Effect.gen(function* () {
      convex.query.mockRejectedValueOnce(refusal());
      const exit = yield* Effect.exit(
        readRequired(openExam, openArgs, "token-alice")
      );
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        expect(isNotFound(Cause.squash(exit.cause))).toBe(true);
      }
    })
  );

  it.effect("keeps a real failure of a required read as the failure", () =>
    Effect.gen(function* () {
      const cause = new Error("offline");
      convex.query.mockRejectedValueOnce(cause);
      const error = yield* Effect.flip(
        readRequired(openExam, openArgs, "token-alice")
      );
      expect(error).toEqual(new PreloadFailed({ cause }));
    })
  );

  it.effect("leaves an optional part without a value when it is refused", () =>
    Effect.gen(function* () {
      convex.query.mockRejectedValueOnce(refusal());
      const value = yield* readOptional(openExam, openArgs, "token-alice");
      expect(value).toBeUndefined();
    })
  );

  it.effect(
    "reports a real failure of an optional part and leaves it without a value",
    () =>
      Effect.gen(function* () {
        const cause = new Error("offline");
        convex.query.mockRejectedValueOnce(cause);
        const value = yield* readOptional(ref, { locale: "en" }, undefined);
        expect(value).toBeUndefined();
        expect(
          analytics.captureServerExceptionSafely
        ).toHaveBeenCalledExactlyOnceWith(new PreloadFailed({ cause }), {
          operation: ref.convexFunctionName,
          source: "data.readOptional",
        });
      })
  );

  it.effect("returns the value of an optional part that Convex answers", () =>
    Effect.gen(function* () {
      convex.query.mockResolvedValueOnce([]);
      expect(
        yield* readOptional(ref, { locale: "en" }, undefined)
      ).toStrictEqual([]);
    })
  );
});
