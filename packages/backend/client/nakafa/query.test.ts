import { beforeEach, describe, expect, it } from "@effect/vitest";
import { readNakafaRuntimeQuery } from "@repo/backend/client/nakafa/query";
import { ConvexRuntimeQueryError } from "@repo/backend/client/runtime";
import { api } from "@repo/backend/convex/_generated/api";
import { toRuntimeQueryError } from "@repo/backend/test/runtime/query";
import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import type { FunctionArgs } from "convex/server";
import { Effect } from "effect";
import { vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  runtimeQuery: vi.fn(),
}));
vi.mock("@repo/backend/client/runtime", async (importOriginal) => ({
  ...(await importOriginal()),
  readConvexRuntimeQuery: (url: string, query: unknown, args: unknown) =>
    Effect.tryPromise({
      catch: toRuntimeQueryError,
      try: () => runtimeMocks.runtimeQuery(url, query, args),
    }),
}));
describe("readNakafaRuntimeQuery", () => {
  beforeEach(() => {
    runtimeMocks.runtimeQuery.mockReset();
  });
  it.effect(
    "returns generated query results from the shared Convex runtime client",
    () =>
      Effect.gen(function* () {
        const args: FunctionArgs<typeof api.contentRelease.reference.read> = {
          input: {
            appLocale: "en",
            kind: "route",
            publicPath: "articles/example",
          },
        };
        runtimeMocks.runtimeQuery.mockResolvedValueOnce(null);
        const result = yield* readNakafaRuntimeQuery(
          "https://example.convex.cloud",
          api.contentRelease.reference.read,
          args
        );
        expect(result).toBeNull();
        expect(runtimeMocks.runtimeQuery).toHaveBeenCalledWith(
          "https://example.convex.cloud",
          api.contentRelease.reference.read,
          args
        );
      })
  );
  it.effect("maps runtime client failures into Nakafa read errors", () =>
    Effect.gen(function* () {
      const args: FunctionArgs<typeof api.contentRelease.reference.read> = {
        input: {
          appLocale: "en",
          kind: "route",
          publicPath: "articles/example",
        },
      };
      const runtimeError = new ConvexRuntimeQueryError({
        httpStatuses: [],
        networkCodes: [],
        query: "contentRelease/reference:read",
        reason: "client",
      });
      runtimeMocks.runtimeQuery.mockRejectedValueOnce(runtimeError);
      const result = yield* Effect.result(
        readNakafaRuntimeQuery(
          "https://example.convex.cloud",
          api.contentRelease.reference.read,
          args
        )
      );
      expect(result._tag).toBe("Failure");
      if (result._tag === "Failure") {
        expect(result.failure).toBeInstanceOf(NakafaAgentDataReadError);
        expect(result.failure.message).toContain(
          "contentRelease/reference:read"
        );
        expect(result.failure.cause).toBe(runtimeError.message);
      }
    })
  );
  it.effect("preserves classified runtime diagnostics", () =>
    Effect.gen(function* () {
      const args: FunctionArgs<typeof api.contentRelease.reference.read> = {
        input: {
          appLocale: "en",
          kind: "route",
          publicPath: "articles/example",
        },
      };
      const runtimeError = new ConvexRuntimeQueryError({
        httpStatuses: [],
        networkCodes: ["EPIPE"],
        query: "contentRelease/reference:read",
        reason: "transport",
      });
      runtimeMocks.runtimeQuery.mockRejectedValueOnce(runtimeError);
      const result = yield* Effect.result(
        readNakafaRuntimeQuery(
          "https://example.convex.cloud",
          api.contentRelease.reference.read,
          args
        )
      );
      expect(result).toMatchObject({
        failure: {
          cause: runtimeError.message,
          message:
            "Unable to read Nakafa runtime content query: contentRelease/reference:read.",
        },
      });
    })
  );
});
