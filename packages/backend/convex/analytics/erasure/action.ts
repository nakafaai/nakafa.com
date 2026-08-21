import { env, internalAction } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { Effect, Schema } from "effect";

const postHogErasureConfigErrorCode = "POSTHOG_ERASURE_CONFIG_INVALID";
const postHogErasureRequestErrorCode = "POSTHOG_ERASURE_REQUEST_FAILED";
const postHogIngestionHostnameSuffix = /\.i\.posthog\.com$/;
const postHogProjectIdPattern = /^[1-9]\d*$/;
const PostHogBulkEraseResponseSchema = Schema.Struct({
  deletion_errors: Schema.optional(Schema.Array(Schema.Unknown)),
  events_queued_for_deletion: Schema.Boolean,
  persons_deleted: Schema.Finite.check(Schema.isInt()).check(
    Schema.isGreaterThanOrEqualTo(0)
  ),
  persons_found: Schema.Finite.check(Schema.isInt()).check(
    Schema.isGreaterThanOrEqualTo(0)
  ),
  recordings_queued_for_deletion: Schema.Boolean,
});
interface PostHogErasureConfig {
  readonly deletionApiKey: string;
  readonly host: string;
  readonly projectId: string;
}
interface PostHogErasureOptions {
  readonly config: PostHogErasureConfig;
  readonly request: typeof fetch;
}

/** Raised when PostHog erasure credentials are not configured. */
export class PostHogErasureConfigError extends Schema.TaggedError<PostHogErasureConfigError>()(
  "PostHogErasureConfigError",
  {
    code: Schema.Literal(postHogErasureConfigErrorCode),
    message: Schema.String,
  }
) {}

/** Raised when PostHog does not accept the complete erasure request. */
export class PostHogErasureRequestError extends Schema.TaggedError<PostHogErasureRequestError>()(
  "PostHogErasureRequestError",
  {
    code: Schema.Literal(postHogErasureRequestErrorCode),
    message: Schema.String,
  }
) {}

function getDefaultPostHogErasureConfig(): PostHogErasureConfig {
  return {
    deletionApiKey: env.POSTHOG_ERASURE_API_KEY,
    host: env.POSTHOG_HOST,
    projectId: env.POSTHOG_PROJECT_ID,
  };
}

/** Validates and normalizes the credentials required before identity erasure. */
const validatePostHogErasureConfig = Effect.fn(
  "analytics.erasure.validatePostHogErasureConfig"
)(function* (config: PostHogErasureConfig) {
  const deletionApiKey = config.deletionApiKey.trim();
  const projectId = config.projectId.trim();
  if (!(deletionApiKey && postHogProjectIdPattern.test(projectId))) {
    return yield* new PostHogErasureConfigError({
      code: postHogErasureConfigErrorCode,
      message: "PostHog person erasure credentials are not configured.",
    });
  }
  const hostUrl = yield* Effect.try({
    try: () => new URL(config.host),
    catch: () =>
      new PostHogErasureConfigError({
        code: postHogErasureConfigErrorCode,
        message: "PostHog erasure host is invalid.",
      }),
  });
  const hasTrustedHost = postHogIngestionHostnameSuffix.test(hostUrl.hostname);
  if (hostUrl.protocol !== "https:" || hostUrl.port || !hasTrustedHost) {
    return yield* new PostHogErasureConfigError({
      code: postHogErasureConfigErrorCode,
      message: "PostHog erasure host is invalid.",
    });
  }
  hostUrl.hostname = hostUrl.hostname.replace(
    postHogIngestionHostnameSuffix,
    ".posthog.com"
  );
  return {
    apiOrigin: hostUrl.origin,
    deletionApiKey,
    projectId,
  };
});

/** Fails before account deletion when PostHog erasure cannot execute. */
export const ensurePostHogErasureConfigured = Effect.fn(
  "analytics.erasure.ensurePostHogErasureConfigured"
)(function* (config: PostHogErasureConfig = getDefaultPostHogErasureConfig()) {
  yield* validatePostHogErasureConfig(config);
});

/** Erases the PostHog person, historical events, and session recordings. */
export const erasePostHogPerson = Effect.fn(
  "analytics.erasure.erasePostHogPerson"
)(function* (
  distinctId: string,
  options: PostHogErasureOptions = {
    config: getDefaultPostHogErasureConfig(),
    request: fetch,
  }
) {
  const { apiOrigin, deletionApiKey, projectId } =
    yield* validatePostHogErasureConfig(options.config);
  const endpoint = `${apiOrigin}/api/projects/${encodeURIComponent(projectId)}/persons/bulk_delete/`;
  const response = yield* Effect.tryPromise({
    try: () =>
      options.request(endpoint, {
        body: JSON.stringify({
          delete_events: true,
          delete_recordings: true,
          distinct_ids: [distinctId],
          keep_person: false,
        }),
        headers: {
          Authorization: `Bearer ${deletionApiKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    catch: () =>
      new PostHogErasureRequestError({
        code: postHogErasureRequestErrorCode,
        message: "PostHog person erasure request could not be sent.",
      }),
  });
  if (!response.ok) {
    return yield* new PostHogErasureRequestError({
      code: postHogErasureRequestErrorCode,
      message: `PostHog person erasure returned HTTP ${response.status}.`,
    });
  }
  const responseBody = yield* Effect.tryPromise({
    try: (): Promise<unknown> => response.json(),
    catch: () =>
      new PostHogErasureRequestError({
        code: postHogErasureRequestErrorCode,
        message: "PostHog person erasure returned an invalid response.",
      }),
  });
  const result = yield* Schema.decodeUnknownEffect(
    PostHogBulkEraseResponseSchema
  )(responseBody).pipe(
    Effect.mapError(
      () =>
        new PostHogErasureRequestError({
          code: postHogErasureRequestErrorCode,
          message: "PostHog person erasure returned an invalid response.",
        })
    )
  );
  const matchedPersonsWereQueued =
    result.persons_found === 0 ||
    (result.events_queued_for_deletion &&
      result.recordings_queued_for_deletion);
  const everyMatchedPersonWasDeleted =
    result.persons_deleted === result.persons_found;
  if (
    (result.deletion_errors?.length ?? 0) > 0 ||
    !matchedPersonsWereQueued ||
    !everyMatchedPersonWasDeleted
  ) {
    return yield* new PostHogErasureRequestError({
      code: postHogErasureRequestErrorCode,
      message: "PostHog did not accept complete analytics erasure.",
    });
  }
});

/** Convex action boundary for durable analytics erasure workflows. */
export const eraseUserAnalytics = internalAction({
  args: {
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (_ctx, args) => {
    await runConvexProgram(erasePostHogPerson(args.userId));
    return null;
  },
});
