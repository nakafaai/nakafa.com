import { FunctionSpec, Ref } from "@confect/core";
import { afterEach, describe, expect, it, vi } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { getUnknownMessage } from "@repo/backend/scripts/lib/errors";
import { Effect, Exit, Schema } from "effect";

class ConvexTestError extends Schema.TaggedError<ConvexTestError>()(
  "ConvexTestError",
  {
    message: Schema.String,
  }
) {}

const convexClientConfig = {
  accessToken: "token",
  url: "https://example.convex.cloud",
};

const deleteArticlesBatch =
  refs.internal.contentSync.mutations.maintenance.deleteArticlesBatch;

const integerArgsMutation = Ref.make(
  "test/mutations",
  FunctionSpec.internalMutation({
    name: "integerArgs",
    args: Schema.Struct({ value: Schema.Int }),
    returns: Schema.Null,
  })
);

/** Restores Convex client mocks between sync-content tests. */
function resetConvexTestModules() {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
}

afterEach(resetConvexTestModules);

describe("sync-content Convex client", () => {
  it.effect(
    "calls a Convex endpoint with encoded refs and decoded returns",
    () =>
      Effect.gen(function* () {
        const fetchMock = vi.fn().mockResolvedValue({
          json: () =>
            Promise.resolve({
              status: "success",
              value: { deleted: 2, hasMore: false },
            }),
        });
        vi.stubGlobal("fetch", fetchMock);
        const { callConvex } = yield* Effect.promise(
          () => import("@repo/backend/scripts/sync-content/convex")
        );

        const result = yield* callConvex(
          convexClientConfig,
          "mutation",
          deleteArticlesBatch,
          {}
        );

        expect(result).toStrictEqual({ deleted: 2, hasMore: false });
        expect(fetchMock).toHaveBeenCalledWith(
          "https://example.convex.cloud/api/mutation",
          {
            body: JSON.stringify({
              path: "contentSync/mutations/maintenance:deleteArticlesBatch",
              args: {},
              format: "json",
            }),
            headers: {
              Authorization: "Convex token",
              "Content-Type": "application/json",
            },
            method: "POST",
          }
        );
      })
  );

  it.effect.each([
    [
      () =>
        Effect.gen(function* () {
          const { callConvex } = yield* Effect.tryPromise({
            try: () => import("@repo/backend/scripts/sync-content/convex"),
            catch: (error) =>
              new ConvexTestError({ message: getUnknownMessage(error) }),
          });

          yield* callConvex(
            convexClientConfig,
            "mutation",
            integerArgsMutation,
            { value: 1.5 }
          );
          return null;
        }),
      "Invalid Convex args",
    ],
    [
      () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue("network failed"));
        return Effect.gen(function* () {
          const { callConvex } = yield* Effect.tryPromise({
            try: () => import("@repo/backend/scripts/sync-content/convex"),
            catch: (error) =>
              new ConvexTestError({ message: getUnknownMessage(error) }),
          });

          yield* callConvex(
            convexClientConfig,
            "mutation",
            deleteArticlesBatch,
            {}
          );
          return null;
        });
      },
      "network failed",
    ],
    [
      () => {
        vi.stubGlobal(
          "fetch",
          vi.fn().mockResolvedValue({
            json: () => Promise.reject(new Error("json failed")),
          })
        );
        return Effect.gen(function* () {
          const { callConvex } = yield* Effect.tryPromise({
            try: () => import("@repo/backend/scripts/sync-content/convex"),
            catch: (error) =>
              new ConvexTestError({ message: getUnknownMessage(error) }),
          });

          yield* callConvex(
            convexClientConfig,
            "mutation",
            deleteArticlesBatch,
            {}
          );
          return null;
        });
      },
      "json failed",
    ],
    [
      () => {
        vi.stubGlobal(
          "fetch",
          vi.fn().mockResolvedValue({
            json: () =>
              Promise.resolve({ status: "error", errorMessage: "bad" }),
          })
        );
        return Effect.gen(function* () {
          const { callConvex } = yield* Effect.tryPromise({
            try: () => import("@repo/backend/scripts/sync-content/convex"),
            catch: (error) =>
              new ConvexTestError({ message: getUnknownMessage(error) }),
          });

          yield* callConvex(
            convexClientConfig,
            "mutation",
            deleteArticlesBatch,
            {}
          );
          return null;
        });
      },
      "bad",
    ],
    [
      () => {
        vi.stubGlobal(
          "fetch",
          vi.fn().mockResolvedValue({
            json: () => Promise.resolve({ status: "error" }),
          })
        );
        return Effect.gen(function* () {
          const { callConvex } = yield* Effect.tryPromise({
            try: () => import("@repo/backend/scripts/sync-content/convex"),
            catch: (error) =>
              new ConvexTestError({ message: getUnknownMessage(error) }),
          });

          yield* callConvex(
            convexClientConfig,
            "mutation",
            deleteArticlesBatch,
            {}
          );
          return null;
        });
      },
      "Unknown Convex error",
    ],
    [
      () => {
        vi.stubGlobal(
          "fetch",
          vi.fn().mockResolvedValue({
            json: () => Promise.resolve({ status: "unknown" }),
          })
        );
        return Effect.gen(function* () {
          const { callConvex } = yield* Effect.tryPromise({
            try: () => import("@repo/backend/scripts/sync-content/convex"),
            catch: (error) =>
              new ConvexTestError({ message: getUnknownMessage(error) }),
          });

          yield* callConvex(
            convexClientConfig,
            "mutation",
            deleteArticlesBatch,
            {}
          );
          return null;
        });
      },
      "Invalid Convex response",
    ],
    [
      () => {
        vi.stubGlobal(
          "fetch",
          vi.fn().mockResolvedValue({
            json: () =>
              Promise.resolve({
                status: "success",
                value: { deleted: "two", hasMore: false },
              }),
          })
        );
        return Effect.gen(function* () {
          const { callConvex } = yield* Effect.tryPromise({
            try: () => import("@repo/backend/scripts/sync-content/convex"),
            catch: (error) =>
              new ConvexTestError({ message: getUnknownMessage(error) }),
          });

          yield* callConvex(
            convexClientConfig,
            "mutation",
            deleteArticlesBatch,
            {}
          );
          return null;
        });
      },
      "Invalid Convex value",
    ],
  ] as const)("fails invalid Convex calls", ([effectFactory, message]) =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(effectFactory());

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        expect(exit.cause.toString()).toContain(message);
      }
    })
  );
});
