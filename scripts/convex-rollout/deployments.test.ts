import { describe, expect, it } from "@repo/testing/effect";
import { Effect, Layer, Result } from "effect";
import {
  HttpClient,
  type HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http";
import { readProductionDeployments } from "./deployments.ts";

const OLD_SHA = "1".repeat(40);
const NEW_SHA = "2".repeat(40);
const VERCEL_ENVIRONMENT_SEPARATOR = String.fromCodePoint(8211);

function makeHttpClient(
  makeResponse: (request: HttpClientRequest.HttpClientRequest) => Response
) {
  return Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) =>
      Effect.sync(() =>
        HttpClientResponse.fromWeb(request, makeResponse(request))
      )
    )
  );
}

function deployment(id: number, consumer: string, sha: string) {
  return {
    environment: `Production ${VERCEL_ENVIRONMENT_SEPARATOR} ${consumer}`,
    id,
    sha,
  };
}

describe("Convex production deployments", () => {
  it.effect("selects each last successful consumer revision", () =>
    Effect.gen(function* () {
      const result = yield* readProductionDeployments().pipe(
        Effect.provide(
          makeHttpClient((request) => {
            if (request.url.includes("?per_page=100")) {
              return Response.json([
                deployment(12, "www", NEW_SHA),
                deployment(11, "www", OLD_SHA),
                deployment(10, "api", NEW_SHA),
                deployment(9, "mcp", NEW_SHA),
              ]);
            }
            return Response.json([
              { state: request.url.includes("/12/") ? "pending" : "success" },
            ]);
          })
        )
      );

      expect(result).toEqual([
        { consumer: "www", revision: OLD_SHA },
        { consumer: "api", revision: NEW_SHA },
        { consumer: "mcp", revision: NEW_SHA },
      ]);
    })
  );

  it.effect("fails closed when one production consumer has no success", () =>
    Effect.gen(function* () {
      const result = yield* readProductionDeployments().pipe(
        Effect.provide(
          makeHttpClient((request) =>
            request.url.includes("?per_page=100")
              ? Response.json([deployment(10, "www", NEW_SHA)])
              : Response.json([{ state: "success" }])
          )
        ),
        Effect.result
      );

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isSuccess(result)) {
        return;
      }
      expect(result.failure).toMatchObject({
        _tag: "ConvexDeploymentError",
      });
    })
  );
});
