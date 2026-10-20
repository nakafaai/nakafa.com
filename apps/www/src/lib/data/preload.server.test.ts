// @vitest-environment node

import { getFunctionReference } from "@confect/core/Ref";
import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { ConvexError } from "convex/values";
import { Effect, Schema } from "effect";
import { PreloadFailed, preloadConfectQuery } from "@/lib/data/preload.server";

/** The calls that the Convex HTTP client receives, as doubles. */
const convex = vi.hoisted(() => ({
  instances: 0,
  query: vi.fn<(reference: unknown, args: unknown) => Promise<unknown>>(),
  setAuth: vi.fn<(token: string) => void>(),
}));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    address: string;
    constructor(address: string) {
      convex.instances += 1;
      this.address = address;
    }
    query(reference: unknown, args: unknown) {
      return convex.query(reference, args);
    }
    setAuth(token: string) {
      convex.setAuth(token);
    }
  },
}));

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

describe("server preload", () => {
  it.effect("reads the query for a visitor without a token", () =>
    Effect.gen(function* () {
      convex.query.mockResolvedValueOnce([]);
      const value = yield* preloadConfectQuery(
        ref,
        { locale: "en" },
        undefined
      );
      expect(value).toStrictEqual([]);
      expect(convex.setAuth).not.toHaveBeenCalled();
      expect(convex.query).toHaveBeenCalledWith(getFunctionReference(ref), {
        locale: "en",
      });
    })
  );

  it.effect("authenticates the client with the request's token", () =>
    Effect.gen(function* () {
      convex.query.mockResolvedValueOnce([]);
      yield* preloadConfectQuery(ref, { locale: "en" }, "token-alice");
      expect(convex.setAuth).toHaveBeenCalledWith("token-alice");
    })
  );

  it.effect("makes one client per read, so no token is shared", () =>
    Effect.gen(function* () {
      convex.query.mockResolvedValue([]);
      const before = convex.instances;
      yield* preloadConfectQuery(ref, { locale: "en" }, undefined);
      yield* preloadConfectQuery(ref, { locale: "en" }, undefined);
      expect(convex.instances - before).toBe(2);
    })
  );

  it.effect(
    "fails with PreloadFailed when Convex answers a value of another shape",
    () =>
      Effect.gen(function* () {
        convex.query.mockResolvedValueOnce("not a list of rows");
        const error = yield* Effect.flip(
          preloadConfectQuery(ref, { locale: "en" }, undefined)
        );
        expect(error).toBeInstanceOf(PreloadFailed);
        expect(error._tag).toBe("PreloadFailed");
      })
  );

  it.effect("fails with PreloadFailed when Convex refuses the read", () =>
    Effect.gen(function* () {
      const cause = new Error("offline");
      convex.query.mockRejectedValueOnce(cause);
      const error = yield* Effect.flip(
        preloadConfectQuery(ref, { locale: "en" }, undefined)
      );
      expect(error).toEqual(new PreloadFailed({ cause }));
    })
  );

  it.effect("decodes a refusal the query declares into its typed error", () =>
    Effect.gen(function* () {
      convex.query.mockRejectedValueOnce(refusal());
      const error = yield* Effect.flip(
        preloadConfectQuery(openExam, openArgs, "token-alice")
      );
      expect(error).toBeInstanceOf(AccessDenied);
    })
  );
});
