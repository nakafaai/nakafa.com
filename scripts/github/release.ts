import { Effect, Option, Redacted, Schema } from "effect";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";
import { GITHUB_ACTION_REVIEWS } from "#scripts/github/policy";

const GithubRelease = Schema.Struct({ tag_name: Schema.String });

export const GithubActionReleaseReviewSchema = Schema.Struct({
  expectedTag: Schema.String,
  reason: Schema.String,
  repository: Schema.String,
});
export type GithubActionReleaseReview = Schema.Schema.Type<
  typeof GithubActionReleaseReviewSchema
>;

/** Expected failure while reading upstream GitHub Action release metadata. */
export class GithubActionReleaseError extends Schema.TaggedError<GithubActionReleaseError>()(
  "GithubActionReleaseError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

function actionRepository(action: string) {
  return action.split("/").slice(0, 2).join("/");
}

/** Returns one consistent latest-release review for each upstream repository. */
export const githubActionReleaseReviews = Effect.fn(
  "RepositoryPolicy.githubActionReleaseReviews"
)(function* () {
  const reviews = new Map<string, GithubActionReleaseReview>();

  for (const actionReview of GITHUB_ACTION_REVIEWS) {
    const repository = actionRepository(actionReview.action);
    const existing = reviews.get(repository);
    const review = {
      expectedTag: actionReview.expectedTag,
      reason: actionReview.reason,
      repository,
    };

    if (existing && existing.expectedTag !== review.expectedTag) {
      return yield* new GithubActionReleaseError({
        cause: repository,
        message: `${repository} has conflicting action release reviews.`,
      });
    }
    reviews.set(repository, existing ?? review);
  }

  return [...reviews.values()];
});

/** Fetches the current stable tag for one reviewed GitHub Action repository. */
export const fetchLatestGithubActionTag = Effect.fn(
  "RepositoryPolicy.fetchLatestGithubActionTag"
)(function* (
  review: Pick<GithubActionReleaseReview, "repository">,
  token: Option.Option<Redacted.Redacted> = Option.none()
) {
  const client = yield* HttpClient.HttpClient;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "nakafa-dependency-policy",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (Option.isSome(token)) {
    headers.Authorization = `Bearer ${Redacted.value(token.value)}`;
  }
  const url = `https://api.github.com/repos/${review.repository}/releases/latest`;

  return yield* client.get(url, { headers }).pipe(
    Effect.flatMap(HttpClientResponse.filterStatusOk),
    Effect.flatMap(HttpClientResponse.schemaBodyJson(GithubRelease)),
    Effect.map((release) => release.tag_name),
    Effect.mapError(
      (cause) =>
        new GithubActionReleaseError({
          cause,
          message: `Unable to read the latest ${review.repository} release.`,
        })
    )
  );
});
