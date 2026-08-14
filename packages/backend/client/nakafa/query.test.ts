import { readNakafaRuntimeQuery } from "@repo/backend/client/nakafa/query";
import { ConvexRuntimeQueryError } from "@repo/backend/client/runtime";
import { api } from "@repo/backend/convex/_generated/api";
import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import type { FunctionArgs } from "convex/server";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  runtimeQuery: vi.fn(),
}));

vi.mock("@repo/backend/client/runtime", async (importOriginal) => ({
  ...(await importOriginal()),
  readConvexRuntimeQuery: (url: string, query: unknown, args: unknown) =>
    Effect.tryPromise({
      catch: (cause) => cause,
      try: () => runtimeMocks.runtimeQuery(url, query, args),
    }),
}));

describe("readNakafaRuntimeQuery", () => {
  beforeEach(() => {
    runtimeMocks.runtimeQuery.mockReset();
  });

  it("returns generated query results from the shared Convex runtime client", async () => {
    const args: FunctionArgs<typeof api.contentRelease.reference.read> = {
      input: {
        appLocale: "en",
        kind: "route",
        publicPath: "articles/example",
      },
    };
    runtimeMocks.runtimeQuery.mockResolvedValueOnce(null);

    const result = await Effect.runPromise(
      readNakafaRuntimeQuery(
        "https://example.convex.cloud",
        api.contentRelease.reference.read,
        args
      )
    );

    expect(result).toBeNull();
    expect(runtimeMocks.runtimeQuery).toHaveBeenCalledWith(
      "https://example.convex.cloud",
      api.contentRelease.reference.read,
      args
    );
  });

  it("maps runtime client failures into Nakafa read errors", async () => {
    const args: FunctionArgs<typeof api.contentRelease.reference.read> = {
      input: {
        appLocale: "en",
        kind: "route",
        publicPath: "articles/example",
      },
    };
    const runtimeError = new ConvexRuntimeQueryError({
      networkCodes: [],
      query: "contentRelease/reference:read",
      reason: "client",
    });
    runtimeMocks.runtimeQuery.mockRejectedValueOnce(runtimeError);

    const result = await Effect.runPromise(
      Effect.either(
        readNakafaRuntimeQuery(
          "https://example.convex.cloud",
          api.contentRelease.reference.read,
          args
        )
      )
    );

    expect(result._tag).toBe("Left");

    if (result._tag === "Left") {
      expect(result.left).toBeInstanceOf(NakafaAgentDataReadError);
      expect(result.left.message).toContain("contentRelease/reference:read");
      expect(result.left.cause).toBe(runtimeError.message);
    }
  });

  it("preserves classified runtime diagnostics", async () => {
    const args: FunctionArgs<typeof api.contentRelease.reference.read> = {
      input: {
        appLocale: "en",
        kind: "route",
        publicPath: "articles/example",
      },
    };
    const runtimeError = new ConvexRuntimeQueryError({
      networkCodes: ["EPIPE"],
      query: "contentRelease/reference:read",
      reason: "transport",
    });
    runtimeMocks.runtimeQuery.mockRejectedValueOnce(runtimeError);

    const result = await Effect.runPromise(
      Effect.either(
        readNakafaRuntimeQuery(
          "https://example.convex.cloud",
          api.contentRelease.reference.read,
          args
        )
      )
    );

    expect(result).toMatchObject({
      left: {
        cause: runtimeError.message,
        message:
          "Unable to read Nakafa runtime content query: contentRelease/reference:read.",
      },
    });
  });
});
