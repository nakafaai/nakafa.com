// @vitest-environment node

import { SigningKeyIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect, Redacted } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PreviewConfig } from "@/lib/content/preview/config";
import {
  fetchPreviewJson,
  MAX_PREVIEW_MANIFEST_BYTES,
} from "@/lib/content/preview/request";

vi.mock("server-only", () => ({}));

const target = "http://127.0.0.1:4000/v1/manifest";
const config: PreviewConfig = {
  eventsPath: "/v1/events",
  keyId: SigningKeyIdSchema.make("local-preview"),
  manifestPath: "/v1/manifest",
  origin: new URL("http://127.0.0.1:4000/"),
  publicKey: "test-public-key",
  token: Redacted.make("secret-token"),
};

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Builds one response whose final URL matches the Fetch contract. */
function response(
  body: BodyInit | null,
  options?: ResponseInit & { readonly url?: string }
) {
  const value = new Response(body, options);
  Object.defineProperty(value, "url", {
    value: options?.url ?? target,
  });
  return value;
}

/** Runs one preview fetch at the Effect boundary. */
function run(maxBytes = MAX_PREVIEW_MANIFEST_BYTES) {
  return Effect.runPromise(
    fetchPreviewJson(config, config.manifestPath, maxBytes)
  );
}

/** Returns one typed request failure without losing its error channel. */
function runFailure(
  maxBytes = MAX_PREVIEW_MANIFEST_BYTES,
  path: string = config.manifestPath
) {
  return Effect.runPromise(
    fetchPreviewJson(config, path, maxBytes).pipe(Effect.flip)
  );
}

describe("local preview JSON requests", () => {
  it("sends a private bearer request and decodes bounded JSON", async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(
        response('{"status":"ready"}', {
          headers: { "content-type": "application/json; charset=utf-8" },
          status: 200,
        })
      )
    );
    vi.stubGlobal("fetch", fetcher);

    await expect(run()).resolves.toEqual({ status: "ready" });
    expect(fetcher).toHaveBeenCalledWith(
      new URL(target),
      expect.objectContaining({
        cache: "no-store",
        credentials: "omit",
        headers: {
          accept: "application/json",
          authorization: "Bearer secret-token",
        },
        redirect: "error",
        referrerPolicy: "no-referrer",
      })
    );
  });

  it("maps connection failures without exposing their cause", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("secret")))
    );
    await expect(runFailure()).resolves.toMatchObject({
      _tag: "PreviewRequestError",
      stage: "connect",
    });
  });

  it.each([
    "//attacker.test/steal",
    "/v1/artifacts/%2e%2e%2fmanifest",
    `/v1/artifacts/sha256%3a${"a".repeat(64)}`,
  ])(
    "rejects non-contract path %s before sending its bearer token",
    async (path) => {
      const fetcher = vi.fn();
      vi.stubGlobal("fetch", fetcher);

      await expect(
        runFailure(MAX_PREVIEW_MANIFEST_BYTES, path)
      ).resolves.toMatchObject({ _tag: "PreviewConfigError" });
      expect(fetcher).not.toHaveBeenCalled();
    }
  );

  it("sends the bearer token only to an exact content-addressed artifact", async () => {
    const artifactPath = `/v1/artifacts/sha256%3A${"a".repeat(64)}`;
    const artifactTarget = `http://127.0.0.1:4000${artifactPath}`;
    const fetcher = vi.fn(() =>
      Promise.resolve(
        response("{}", {
          headers: { "content-type": "application/json" },
          status: 200,
          url: artifactTarget,
        })
      )
    );
    vi.stubGlobal("fetch", fetcher);

    await expect(
      Effect.runPromise(fetchPreviewJson(config, artifactPath, 1024))
    ).resolves.toEqual({});
    expect(fetcher).toHaveBeenCalledWith(
      new URL(artifactTarget),
      expect.objectContaining({
        credentials: "omit",
        headers: expect.objectContaining({
          authorization: "Bearer secret-token",
        }),
        redirect: "error",
        referrerPolicy: "no-referrer",
      })
    );
  });

  it.each([
    ["status", response("{}", { status: 409 })],
    [
      "redirected URL",
      response("{}", {
        headers: { "content-type": "application/json" },
        status: 200,
        url: "http://127.0.0.1:4000/elsewhere",
      }),
    ],
    [
      "missing content type",
      response(new TextEncoder().encode("{}"), { status: 200 }),
    ],
    [
      "non-JSON content type",
      response("{}", {
        headers: { "content-type": "application/json-seq" },
        status: 200,
      }),
    ],
  ])("rejects an invalid %s response", async (_label, value) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(value))
    );
    await expect(runFailure()).resolves.toMatchObject({
      _tag: "PreviewRequestError",
      stage: "response",
      status: value.status,
    });
  });

  it("rejects a response without a body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          response(null, {
            headers: { "content-type": "application/json" },
            status: 200,
          })
        )
      )
    );
    await expect(runFailure()).resolves.toMatchObject({
      _tag: "PreviewRequestError",
      stage: "body",
    });
  });

  it("cancels a response that crosses its byte ceiling", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        response('{"value":"too large"}', {
          headers: { "content-type": "application/json" },
          status: 200,
        })
      )
      .mockResolvedValueOnce({
        body: {
          /** Returns one oversized chunk before provider cancellation. */
          getReader: () => ({
            cancel: () => Promise.reject(new TypeError("cancel failed")),
            read: () =>
              Promise.resolve({
                done: false,
                value: new TextEncoder().encode("oversized"),
              }),
          }),
        },
        headers: new Headers({ "content-type": "application/json" }),
        status: 200,
        url: target,
      });
    vi.stubGlobal("fetch", fetcher);

    await expect(runFailure(4)).resolves.toMatchObject({
      _tag: "PreviewBodyLimitError",
      maxBytes: 4,
    });
    await expect(runFailure(4)).resolves.toMatchObject({
      _tag: "PreviewBodyLimitError",
      maxBytes: 4,
    });
  });

  it("maps stream, UTF-8, and JSON decoding failures", async () => {
    const stream = new ReadableStream({
      /** Fails before exposing provider bytes. */
      pull(controller) {
        controller.error(new TypeError("stream failed"));
      },
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          response(stream, {
            headers: { "content-type": "application/json" },
            status: 200,
          })
        )
        .mockResolvedValueOnce(
          response(new Uint8Array([255]), {
            headers: { "content-type": "application/json" },
            status: 200,
          })
        )
        .mockResolvedValueOnce(
          response("not-json", {
            headers: { "content-type": "application/json" },
            status: 200,
          })
        )
    );

    await expect(runFailure()).resolves.toMatchObject({ stage: "body" });
    await expect(runFailure()).resolves.toMatchObject({ stage: "body" });
    await expect(runFailure()).resolves.toMatchObject({ stage: "body" });
  });
});
