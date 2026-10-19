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

vi.mock("@confect/core/Ref", () => ({
  decodeReturns: (_ref: unknown, value: unknown) =>
    Effect.succeed({ decoded: value }),
  encodeArgs: (_ref: unknown, args: unknown) =>
    Effect.succeed({ encoded: args }),
  getFunctionReference: () => "reference",
}));

process.env.VITE_CONVEX_URL = "https://example.convex.cloud";

/** A real public query reference: the codec is replaced below, so only its type is used. */
const ref = refs.public.contents.queries.recent.getRecentlyViewed;

describe("server preload", () => {
  it.effect("reads the query for a visitor without a token", () =>
    Effect.gen(function* () {
      convex.query.mockResolvedValueOnce("value");
      const value = yield* preloadConfectQuery(
        ref,
        { locale: "en" },
        undefined
      );
      expect(value).toStrictEqual({ decoded: "value" });
      expect(convex.setAuth).not.toHaveBeenCalled();
      expect(convex.query).toHaveBeenCalledWith("reference", {
        encoded: { locale: "en" },
      });
    })
  );

  it.effect("authenticates the client with the request's token", () =>
    Effect.gen(function* () {
      convex.query.mockResolvedValueOnce("value");
      yield* preloadConfectQuery(ref, { locale: "en" }, "token-alice");
      expect(convex.setAuth).toHaveBeenCalledWith("token-alice");
    })
  );

  it.effect("makes one client per read, so no token is shared", () =>
    Effect.gen(function* () {
      convex.query.mockResolvedValue("value");
      const before = convex.instances;
      yield* preloadConfectQuery(ref, { locale: "en" }, undefined);
      yield* preloadConfectQuery(ref, { locale: "en" }, undefined);
      expect(convex.instances - before).toBe(2);
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
