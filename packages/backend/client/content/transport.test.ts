// @vitest-environment node

import { ContentTransportError } from "@repo/backend/client/content/errors";
import {
  createContentEndpoint,
  encodeContentRequest,
  postContentRequest,
  readContentResponse,
  validateContentRuntimeStatus,
} from "@repo/backend/client/content/transport";
import { PUBLIC_CONTENT_RUNTIME_PATH } from "@repo/backend/content/endpoint";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const endpoint = "https://example.convex.site/internal/content/runtime";
const target = {
  siteUrl: "https://example.convex.site",
  token: "runtime-test-token",
};
const fetchMock = vi.hoisted(() => vi.fn<typeof fetch>());

vi.mock("server-only", () => ({}));

/** Creates one response with the immutable network URL populated. */
function createResponse(
  body: BodyInit | null,
  status: number,
  headers: HeadersInit = {
    "content-type": "application/json; charset=utf-8",
  },
  url = endpoint
) {
  const response = new Response(body, { headers, status });
  Object.defineProperty(response, "url", { value: url });
  return response;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("content runtime transport", () => {
  it("builds only fixed HTTPS or loopback endpoints", async () => {
    await expect(
      Effect.runPromise(
        createContentEndpoint(
          "https://example.convex.site/ignored",
          PUBLIC_CONTENT_RUNTIME_PATH
        )
      )
    ).resolves.toBe(endpoint);
    await expect(
      Effect.runPromise(
        createContentEndpoint(
          "http://localhost:3211/ignored",
          PUBLIC_CONTENT_RUNTIME_PATH
        )
      )
    ).resolves.toBe("http://localhost:3211/internal/content/runtime");

    for (const siteUrl of [
      "not a URL",
      "http://example.com",
      "ftp://localhost",
      "https://user:secret@example.com",
    ]) {
      await expect(
        Effect.runPromise(
          createContentEndpoint(siteUrl, PUBLIC_CONTENT_RUNTIME_PATH).pipe(
            Effect.flip
          )
        )
      ).resolves.toEqual(new ContentTransportError({ reason: "url" }));
    }
  });

  it("serializes bounded request JSON and rejects invalid values", async () => {
    await expect(
      Effect.runPromise(encodeContentRequest({ locale: "en" }, 1024))
    ).resolves.toBe('{"locale":"en"}');
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    await expect(
      Effect.runPromise(encodeContentRequest(cyclic, 1024).pipe(Effect.flip))
    ).resolves.toMatchObject({ reason: "request" });
    await expect(
      Effect.runPromise(
        encodeContentRequest({ value: "x".repeat(1024) }, 10).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({ reason: "request-size" });
  });

  it("posts one private no-store request with the server credential", async () => {
    const response = createResponse("{}", 200);
    fetchMock.mockResolvedValue(response);

    await expect(
      Effect.runPromise(postContentRequest({ endpoint, source: "{}", target }))
    ).resolves.toBe(response);
    expect(fetchMock).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        body: "{}",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-nakafa-content-token": target.token,
        },
        method: "POST",
        redirect: "error",
        signal: expect.any(AbortSignal),
      })
    );
  });

  it("reads exact bounded JSON and rejects untrusted responses", async () => {
    await expect(
      Effect.runPromise(
        readContentResponse(
          createResponse('{"kind":"missing"}', 404),
          endpoint,
          1024
        )
      )
    ).resolves.toEqual({ kind: "missing" });

    const invalid: readonly [Response, string][] = [
      [
        createResponse("{}", 200, undefined, "https://other.test"),
        "response-url",
      ],
      [
        createResponse("{}", 200, { "content-type": "text/plain" }),
        "content-type",
      ],
      [
        createResponse("{}", 200, {
          "content-length": "invalid",
          "content-type": "application/json",
        }),
        "content-length",
      ],
      [createResponse("{", 200), "json"],
      [createResponse("x".repeat(20), 200), "response-size"],
    ];
    for (const [response, reason] of invalid) {
      await expect(
        Effect.runPromise(
          readContentResponse(response, endpoint, 10).pipe(Effect.flip)
        )
      ).resolves.toMatchObject({ reason });
    }
  });

  it("accepts only contract-owned response status pairs", async () => {
    for (const [response, status] of [
      [{ kind: "found" }, 200],
      [{ kind: "missing" }, 404],
      [{ code: "CONTENT_RUNTIME_UNAUTHORIZED", kind: "failure" }, 401],
      [{ code: "CONTENT_RUNTIME_INVALID", kind: "failure" }, 413],
      [{ code: "CONTENT_RUNTIME_INTERNAL", kind: "failure" }, 500],
      [{ code: "CONTENT_RUNTIME_RESPONSE_TOO_LARGE", kind: "failure" }, 500],
    ] as const) {
      await expect(
        Effect.runPromise(validateContentRuntimeStatus(response, status))
      ).resolves.toBeUndefined();
    }
    await expect(
      Effect.runPromise(
        validateContentRuntimeStatus({ kind: "missing" }, 200).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({ reason: "status" });
  });
});
