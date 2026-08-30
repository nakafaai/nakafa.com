import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Redacted, Result } from "effect";
import {
  HttpClient,
  type HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http";
import {
  fetchQueuePull,
  verifyResolvedReviews,
  verifySourceChecks,
} from "#scripts/github/queue/remote";

const SOURCE_SHA = "3".repeat(40);
const BASE_SHA = "2".repeat(40);
const RUN_ID = "123456";
const context = {
  repository: "nakafaai/nakafa.com",
  token: Redacted.make("github-token"),
};
const pull = {
  base: {
    ref: "main",
    repo: { full_name: "nakafaai/nakafa.com" },
    sha: BASE_SHA,
  },
  head: {
    ref: "codex/example",
    repo: { full_name: "nakafaai/nakafa.com" },
    sha: SOURCE_SHA,
  },
  number: 42,
  state: "open",
  user: { login: "nabilfatih" },
};

const makeHttpClient = (
  makeResponse: (request: HttpClientRequest.HttpClientRequest) => Response
) =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) =>
      Effect.sync(() =>
        HttpClientResponse.fromWeb(request, makeResponse(request))
      )
    )
  );

const successResponse = (request: HttpClientRequest.HttpClientRequest) => {
  if (request.url.endsWith("/pulls/42")) {
    return Response.json(pull);
  }
  if (request.url === "https://api.github.com/graphql") {
    return Response.json({
      data: {
        repository: {
          pullRequest: {
            reviewThreads: {
              nodes: [{ isResolved: true }],
              pageInfo: { endCursor: null, hasNextPage: false },
            },
          },
        },
      },
    });
  }
  if (request.url.includes("/check-runs?")) {
    const checkName = request.url.includes("check_name=Doctor")
      ? "Doctor"
      : "Required";
    return Response.json({
      check_runs: [
        {
          app: { id: 15_368 },
          conclusion: "success",
          details_url: `https://github.com/nakafaai/nakafa.com/actions/runs/${RUN_ID}/job/${checkName === "Doctor" ? "2" : "1"}`,
          head_sha: SOURCE_SHA,
          name: checkName,
          status: "completed",
        },
      ],
      total_count: 1,
    });
  }
  if (request.url.endsWith(`/actions/runs/${RUN_ID}`)) {
    return Response.json({
      actor: { login: "nabilfatih" },
      conclusion: "success",
      event: "pull_request",
      head_branch: "codex/example",
      head_repository: { full_name: "nakafaai/nakafa.com" },
      head_sha: SOURCE_SHA,
      path: ".github/workflows/ci.yml",
      pull_requests: [
        {
          base: {
            ref: "main",
            repo: { url: "https://api.github.com/repos/nakafaai/nakafa.com" },
            sha: BASE_SHA,
          },
          head: {
            ref: "codex/example",
            repo: { url: "https://api.github.com/repos/nakafaai/nakafa.com" },
            sha: SOURCE_SHA,
          },
          number: 42,
        },
      ],
      status: "completed",
    });
  }
  return new Response(null, { status: 404 });
};

describe("merge queue GitHub proof", () => {
  it.effect("reads the queued pull and resolved reviews", () =>
    Effect.gen(function* () {
      const observedPull = yield* fetchQueuePull(context, 42);
      const reviewCount = yield* verifyResolvedReviews(context, 42);

      expect(observedPull).toEqual(pull);
      expect(reviewCount).toBe(1);
    }).pipe(Effect.provide(makeHttpClient(successResponse)))
  );

  it.effect("accepts exact source checks from one trusted workflow run", () =>
    verifySourceChecks(context, pull).pipe(
      Effect.tap((runId) =>
        Effect.sync(() => {
          expect(runId).toBe(RUN_ID);
        })
      ),
      Effect.provide(makeHttpClient(successResponse))
    )
  );

  it.effect("rejects source checks created for another base", () =>
    verifySourceChecks(context, pull).pipe(
      Effect.provide(
        makeHttpClient((request) => {
          if (request.url.endsWith(`/actions/runs/${RUN_ID}`)) {
            return Response.json({
              actor: { login: "nabilfatih" },
              conclusion: "success",
              event: "pull_request",
              head_branch: "codex/example",
              head_repository: { full_name: "nakafaai/nakafa.com" },
              head_sha: SOURCE_SHA,
              path: ".github/workflows/ci.yml",
              pull_requests: [
                {
                  base: {
                    ref: "release",
                    repo: {
                      url: "https://api.github.com/repos/nakafaai/nakafa.com",
                    },
                    sha: "1".repeat(40),
                  },
                  head: {
                    ref: "codex/example",
                    repo: {
                      url: "https://api.github.com/repos/nakafaai/nakafa.com",
                    },
                    sha: SOURCE_SHA,
                  },
                  number: 42,
                },
              ],
              status: "completed",
            });
          }
          return successResponse(request);
        })
      ),
      Effect.result,
      Effect.tap((result) =>
        Effect.sync(() => {
          expect(Result.isFailure(result)).toBe(true);
        })
      )
    )
  );

  it.effect("rejects every unresolved review thread", () =>
    verifyResolvedReviews(context, 42).pipe(
      Effect.provide(
        makeHttpClient(() =>
          Response.json({
            data: {
              repository: {
                pullRequest: {
                  reviewThreads: {
                    nodes: [{ isResolved: false }],
                    pageInfo: { endCursor: null, hasNextPage: false },
                  },
                },
              },
            },
          })
        )
      ),
      Effect.result,
      Effect.tap((result) =>
        Effect.sync(() => {
          expect(Result.isFailure(result)).toBe(true);
        })
      )
    )
  );
});
