import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, Layer, Option, Redacted, Result } from "effect";
import {
  HttpClient,
  type HttpClientRequest,
  HttpClientResponse,
} from "effect/http";
import {
  fetchLatestGithubActionTag,
  githubActionReleaseReviews,
} from "#scripts/github/release";

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

describe("GitHub Action releases", () => {
  it.effect("deduplicates reviews by upstream repository", () =>
    Effect.gen(function* () {
      const reviews = yield* githubActionReleaseReviews();
      const repositories = Arr.map(reviews, ({ repository }) => repository);

      expect(new Set(repositories).size).toBe(repositories.length);
      expect(repositories).not.toContain("actions/cache");
    })
  );

  it.effect("shares one review between actions from the same repository", () =>
    Effect.gen(function* () {
      const review = {
        approvedSha: "0123456789abcdef0123456789abcdef01234567",
        expectedTag: "v4.0.0",
        expectedUsages: 1,
        reason: "CodeQL analysis runs as one reviewed release.",
      };
      const reviews = yield* githubActionReleaseReviews([
        { ...review, action: "github/codeql-action/init" },
        { ...review, action: "github/codeql-action/analyze" },
      ]);
      const conflict = yield* githubActionReleaseReviews([
        { ...review, action: "github/codeql-action/init" },
        {
          ...review,
          action: "github/codeql-action/analyze",
          expectedTag: "v3.0.0",
        },
      ]).pipe(Effect.flip);

      expect(reviews).toEqual([
        {
          expectedTag: "v4.0.0",
          reason: review.reason,
          repository: "github/codeql-action",
        },
      ]);
      expect(conflict).toMatchObject({
        _tag: "GithubActionReleaseError",
        cause: "github/codeql-action",
        message: "github/codeql-action has conflicting action release reviews.",
      });
    })
  );

  it.effect("authenticates release reads with a configured token", () =>
    Effect.gen(function* () {
      let observedRequest: HttpClientRequest.HttpClientRequest | undefined;
      yield* fetchLatestGithubActionTag(
        { repository: "actions/checkout" },
        Option.some(Redacted.make("reviewed-token"))
      ).pipe(
        Effect.provide(
          makeHttpClient((request) => {
            observedRequest = request;
            return Response.json({ tag_name: "v7.0.1" });
          })
        )
      );

      expect(observedRequest?.headers).toMatchObject({
        accept: "application/vnd.github+json",
        authorization: "Bearer reviewed-token",
        "user-agent": "nakafa-dependency-policy",
        "x-github-api-version": "2022-11-28",
      });
    })
  );

  it.effect("reads release metadata through the Effect HTTP client", () =>
    Effect.gen(function* () {
      let observedRequest: HttpClientRequest.HttpClientRequest | undefined;
      const releaseTag = yield* fetchLatestGithubActionTag({
        repository: "actions/checkout",
      }).pipe(
        Effect.provide(
          makeHttpClient((request) => {
            observedRequest = request;
            return Response.json({ tag_name: "v7.0.1" });
          })
        )
      );

      expect(releaseTag).toBe("v7.0.1");
      expect(observedRequest?.url).toBe(
        "https://api.github.com/repos/actions/checkout/releases/latest"
      );
    })
  );

  it.effect("rejects unavailable GitHub release metadata", () =>
    Effect.gen(function* () {
      const result = yield* fetchLatestGithubActionTag({
        repository: "actions/checkout",
      }).pipe(
        Effect.provide(
          makeHttpClient(() => new Response(null, { status: 403 }))
        ),
        Effect.result
      );

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isSuccess(result)) {
        return;
      }
      expect(result.failure).toMatchObject({
        _tag: "GithubActionReleaseError",
        message: "Unable to read the latest actions/checkout release.",
      });
    })
  );
});
