// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { ContentTransportError } from "@repo/backend/client/content/errors";
import {
  createContentContractError,
  validateContentRuntimeStatus,
} from "@repo/backend/client/content/status";
import {
  CONTENT_RUNTIME_RESPONSE_HEADER,
  CONTENT_RUNTIME_RESPONSE_MARKER,
  PUBLIC_CONTENT_RUNTIME_PATH,
} from "@repo/backend/content/endpoint";
import { Effect } from "effect";
import { HttpClientRequest, HttpClientResponse } from "effect/http";

const endpoint = `https://example.convex.site${PUBLIC_CONTENT_RUNTIME_PATH}`;

/** Wraps one web response the way Effect's client hands it to a reader. */
function received(response: Response) {
  return HttpClientResponse.fromWeb(HttpClientRequest.post(endpoint), response);
}

describe("content runtime status", () => {
  it("classifies an untrusted response by its runtime marker", () => {
    expect(
      createContentContractError(
        received(
          new Response("{}", {
            headers: {
              "content-type": "application/json; charset=utf-8",
              [CONTENT_RUNTIME_RESPONSE_HEADER]:
                CONTENT_RUNTIME_RESPONSE_MARKER,
            },
          })
        )
      )
    ).toEqual(new ContentTransportError({ reason: "response-contract" }));
    expect(
      createContentContractError(
        received(
          new Response("{}", {
            headers: { "content-type": "application/json" },
          })
        )
      )
    ).toEqual(new ContentTransportError({ reason: "response-unmarked" }));
  });

  it.live("accepts only contract-owned response status pairs", () =>
    Effect.gen(function* () {
      for (const [response, status] of [
        [{ kind: "found" }, 200],
        [{ kind: "missing" }, 404],
        [{ code: "CONTENT_RUNTIME_UNAUTHORIZED", kind: "failure" }, 401],
        [{ code: "CONTENT_RUNTIME_INVALID", kind: "failure" }, 400],
        [{ code: "CONTENT_RUNTIME_INVALID", kind: "failure" }, 413],
        [{ code: "CONTENT_RUNTIME_INVALID", kind: "failure" }, 415],
        [{ code: "CONTENT_RUNTIME_INTERNAL", kind: "failure" }, 500],
        [{ code: "CONTENT_RUNTIME_RESPONSE_TOO_LARGE", kind: "failure" }, 500],
      ] as const) {
        expect(
          yield* validateContentRuntimeStatus(response, status)
        ).toBeUndefined();
      }
      for (const [response, status] of [
        [{ kind: "missing" }, 200],
        [{ code: "CONTENT_RUNTIME_UNAUTHORIZED", kind: "failure" }, 403],
        [{ code: "CONTENT_RUNTIME_INVALID", kind: "failure" }, 422],
        [{ code: "CONTENT_RUNTIME_INTERNAL", kind: "failure" }, 503],
        [{ code: "CONTENT_RUNTIME_RESPONSE_TOO_LARGE", kind: "failure" }, 413],
      ] as const) {
        expect(
          yield* validateContentRuntimeStatus(response, status).pipe(
            Effect.flip
          )
        ).toMatchObject({ reason: "status" });
      }
    })
  );
});
