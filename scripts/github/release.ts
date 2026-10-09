import {
  Array as Arr,
  Data,
  Duration,
  Effect,
  MutableHashMap,
  Option,
  Redacted,
  Schema,
} from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import {
  GITHUB_ACTION_REVIEWS,
  type GithubActionReview,
} from "#scripts/github/policy";

const GithubRelease = Schema.Struct({ tag_name: Schema.String });

export const GithubActionReleaseReviewSchema = Schema.Struct({
  expectedTag: Schema.String,
  reason: Schema.String,
  repository: Schema.String,
});
export type GithubActionReleaseReview =
  typeof GithubActionReleaseReviewSchema.Type;

/** Expected failure while reading upstream GitHub Action release metadata. */
export class GithubActionReleaseError extends Schema.TaggedError<GithubActionReleaseError>()(
  "GithubActionReleaseError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/**
 * The longest one release read may take. It is the 10 second attempt budget of
 * the web app's network reads, kept here because the root scripts do not depend
 * on `@repo/backend`.
 */
const GITHUB_RELEASE_DEADLINE = Duration.seconds(10);

/** The release read did not finish within its deadline. */
class GithubReleaseDeadline extends Data.TaggedError("GithubReleaseDeadline") {}

function actionRepository(action: string) {
  return Arr.join(action.split("/").slice(0, 2), "/");
}

/** Returns one consistent latest-release review for each upstream repository. */
export const githubActionReleaseReviews = Effect.fn(
  "RepositoryPolicy.githubActionReleaseReviews"
)(function* (
  actionReviews: readonly GithubActionReview[] = GITHUB_ACTION_REVIEWS
) {
  const reviews = MutableHashMap.empty<string, GithubActionReleaseReview>();

  for (const actionReview of actionReviews) {
    const repository = actionRepository(actionReview.action);
    const existing = Option.getOrUndefined(
      MutableHashMap.get(reviews, repository)
    );
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
    MutableHashMap.set(reviews, repository, existing ?? review);
  }

  return Arr.fromIterable(MutableHashMap.values(reviews));
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
    ),
    Effect.timeoutOrElse({
      duration: GITHUB_RELEASE_DEADLINE,
      orElse: () =>
        Effect.fail(
          new GithubActionReleaseError({
            cause: new GithubReleaseDeadline(),
            message: `Unable to read the latest ${review.repository} release within 10 seconds.`,
          })
        ),
    })
  );
});
