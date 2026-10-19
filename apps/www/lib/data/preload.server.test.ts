// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { Effect } from "effect";
import { PreloadFailed, preloadConfectQuery } from "@/lib/data/preload.server";

/** The calls that the Convex HTTP client and the Confect codec receive, as doubles. */
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

vi.mock("@confect/core/Ref", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@confect/core/Ref")>()),
  getFunctionReference: () => "reference",
}));

process.env.VITE_CONVEX_URL = "https://example.convex.cloud";

/** A real public query reference, whose value is a list of learning rows. */
const ref = refs.public.contents.queries.recent.getRecentlyViewed;

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
      expect(convex.query).toHaveBeenCalledWith("reference", { locale: "en" });
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
    "fails the decode when Convex answers a value of another shape",
    () =>
      Effect.gen(function* () {
        convex.query.mockResolvedValueOnce("not a list of rows");
        const error = yield* Effect.flip(
          preloadConfectQuery(ref, { locale: "en" }, undefined)
        );
        expect(error).not.toBeInstanceOf(PreloadFailed);
        expect(error._tag).toBe("SchemaError");
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
});
