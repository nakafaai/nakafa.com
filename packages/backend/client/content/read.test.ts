// @vitest-environment node

import {
  PublicContentFailureError,
  PublicContentMissingError,
  PublicContentVerificationError,
} from "@repo/backend/client/content/errors";
import { readPublicContent } from "@repo/backend/client/content/read";
import { fetchPublicContentRuntime } from "@repo/backend/client/content/request";
import { verifyContentEnvelope } from "@repo/backend/content/verify";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestMock = vi.hoisted(() => vi.fn());
const verifyMock = vi.hoisted(() => vi.fn());
const target = {
  siteUrl: "https://example.convex.site",
  token: "runtime-token",
};
const input = {
  locale: "en" as const,
  publicPath: "articles/politics/example",
};

vi.mock("server-only", () => ({}));
vi.mock("@repo/backend/client/content/request", () => ({
  fetchPublicContentRuntime: requestMock,
}));
vi.mock("@repo/backend/content/verify", () => ({
  verifyContentEnvelope: verifyMock,
}));

beforeEach(() => {
  requestMock.mockReset();
  verifyMock.mockReset();
});

describe("public content read", () => {
  it("returns one verified found envelope", async () => {
    const found = {
      activeReleaseId: "release-example",
      artifact: { payload: { rawMdx: "## Example" } },
      kind: "found",
      projection: { kind: "article" },
    };
    const exchange = {
      request: { delivery: "public", ...input },
      response: found,
      status: 200,
    };
    requestMock.mockReturnValue(Effect.succeed(exchange));
    verifyMock.mockReturnValue(Effect.succeed(found));

    await expect(
      Effect.runPromise(readPublicContent(target, input))
    ).resolves.toBe(found);
    expect(fetchPublicContentRuntime).toHaveBeenCalledWith(target, {
      delivery: "public",
      ...input,
    });
    expect(verifyContentEnvelope).toHaveBeenCalledWith({
      request: exchange.request,
      response: found,
    });
  });

  it("distinguishes exact absence from sanitized runtime failure", async () => {
    requestMock
      .mockReturnValueOnce(
        Effect.succeed({
          request: { delivery: "public", ...input },
          response: { kind: "missing" },
          status: 404,
        })
      )
      .mockReturnValueOnce(
        Effect.succeed({
          request: { delivery: "public", ...input },
          response: {
            code: "CONTENT_RUNTIME_INTERNAL",
            kind: "failure",
          },
          status: 500,
        })
      );
    verifyMock
      .mockReturnValueOnce(Effect.succeed({ kind: "missing" }))
      .mockReturnValueOnce(
        Effect.succeed({
          code: "CONTENT_RUNTIME_INTERNAL",
          kind: "failure",
        })
      );

    const missing = await Effect.runPromise(
      readPublicContent(target, input).pipe(Effect.flip)
    );
    const failure = await Effect.runPromise(
      readPublicContent(target, input).pipe(Effect.flip)
    );

    expect(missing).toEqual(new PublicContentMissingError(input));
    expect(failure).toEqual(
      new PublicContentFailureError({
        code: "CONTENT_RUNTIME_INTERNAL",
        status: 500,
      })
    );
  });

  it("preserves verification failure detail in a typed boundary error", async () => {
    const cause = new Error("signature mismatch");
    requestMock.mockReturnValue(
      Effect.succeed({
        request: { delivery: "public", ...input },
        response: { kind: "found" },
        status: 200,
      })
    );
    verifyMock.mockReturnValue(Effect.fail(cause));

    await expect(
      Effect.runPromise(readPublicContent(target, input).pipe(Effect.flip))
    ).resolves.toEqual(new PublicContentVerificationError({ cause }));
  });
});
