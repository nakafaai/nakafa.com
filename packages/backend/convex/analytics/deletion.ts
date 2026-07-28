import { env, internalAction } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { Effect, Schema } from "effect";

const postHogDeletionConfigErrorCode = "POSTHOG_DELETION_CONFIG_INVALID";
const postHogDeletionRequestErrorCode = "POSTHOG_DELETION_REQUEST_FAILED";
const postHogIngestionHostnameSuffix = /\.i\.posthog\.com$/;
const postHogProjectIdPattern = /^[1-9]\d*$/;

export const POSTHOG_DELETION_RECONCILIATION_DELAY_MS = 24 * 60 * 60 * 1000;

const PostHogBulkDeleteResponseSchema = Schema.Struct({
  deletion_errors: Schema.optional(Schema.Array(Schema.Unknown)),
  events_queued_for_deletion: Schema.Boolean,
  persons_deleted: Schema.Number,
  persons_found: Schema.Number,
  recordings_queued_for_deletion: Schema.Boolean,
});

interface PostHogDeletionConfig {
  readonly deletionApiKey: string;
  readonly host: string;
  readonly projectId: string;
}

interface PostHogDeletionOptions {
  readonly config: PostHogDeletionConfig;
  readonly request: typeof fetch;
}

/** Raised when PostHog erasure credentials are not configured. */
export class PostHogDeletionConfigError extends Schema.TaggedError<PostHogDeletionConfigError>()(
  "PostHogDeletionConfigError",
  {
    code: Schema.Literal(postHogDeletionConfigErrorCode),
    message: Schema.String,
  }
) {}

/** Raised when PostHog does not accept the person-erasure request. */
export class PostHogDeletionRequestError extends Schema.TaggedError<PostHogDeletionRequestError>()(
  "PostHogDeletionRequestError",
  {
    code: Schema.Literal(postHogDeletionRequestErrorCode),
    message: Schema.String,
  }
) {}

function getDefaultPostHogDeletionConfig(): PostHogDeletionConfig {
  return {
    deletionApiKey: env.POSTHOG_ACCOUNT_DELETION_API_KEY,
    host: env.POSTHOG_HOST,
    projectId: env.POSTHOG_PROJECT_ID,
  };
}

/** Validates and normalizes the credentials required before identity removal. */
const validatePostHogDeletionConfig = Effect.fn(
  "analytics.deletion.validatePostHogDeletionConfig"
)(function* (config: PostHogDeletionConfig) {
  const deletionApiKey = config.deletionApiKey.trim();
  const projectId = config.projectId.trim();

  if (!(deletionApiKey && postHogProjectIdPattern.test(projectId))) {
    return yield* new PostHogDeletionConfigError({
      code: postHogDeletionConfigErrorCode,
      message: "PostHog person deletion credentials are not configured.",
    });
  }

  const hostUrl = yield* Effect.try({
    try: () => new URL(config.host),
    catch: () =>
      new PostHogDeletionConfigError({
        code: postHogDeletionConfigErrorCode,
        message: "PostHog deletion host is invalid.",
      }),
  });
  const hasTrustedHost = postHogIngestionHostnameSuffix.test(hostUrl.hostname);

  if (hostUrl.protocol !== "https:" || hostUrl.port || !hasTrustedHost) {
    return yield* new PostHogDeletionConfigError({
      code: postHogDeletionConfigErrorCode,
      message: "PostHog deletion host is invalid.",
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

/** Fails before auth deletion when durable analytics erasure cannot start. */
export const ensurePostHogDeletionConfigured = Effect.fn(
  "analytics.deletion.ensurePostHogDeletionConfigured"
)(function* (
  config: PostHogDeletionConfig = getDefaultPostHogDeletionConfig()
) {
  yield* validatePostHogDeletionConfig(config);
});

/** Deletes the PostHog person, historical events, and session recordings. */
export const deletePostHogPerson = Effect.fn(
  "analytics.deletion.deletePostHogPerson"
)(function* (
  distinctId: string,
  options: PostHogDeletionOptions = {
    config: getDefaultPostHogDeletionConfig(),
    request: fetch,
  }
) {
  const { apiOrigin, deletionApiKey, projectId } =
    yield* validatePostHogDeletionConfig(options.config);
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
      new PostHogDeletionRequestError({
        code: postHogDeletionRequestErrorCode,
        message: "PostHog person deletion request could not be sent.",
      }),
  });

  if (!response.ok) {
    return yield* new PostHogDeletionRequestError({
      code: postHogDeletionRequestErrorCode,
      message: `PostHog person deletion returned HTTP ${response.status}.`,
    });
  }

  const responseBody = yield* Effect.tryPromise({
    try: (): Promise<unknown> => response.json(),
    catch: () =>
      new PostHogDeletionRequestError({
        code: postHogDeletionRequestErrorCode,
        message: "PostHog person deletion returned an invalid response.",
      }),
  });
  const result = yield* Schema.decodeUnknown(PostHogBulkDeleteResponseSchema)(
    responseBody
  ).pipe(
    Effect.mapError(
      () =>
        new PostHogDeletionRequestError({
          code: postHogDeletionRequestErrorCode,
          message: "PostHog person deletion returned an invalid response.",
        })
    )
  );

  if ((result.deletion_errors?.length ?? 0) > 0) {
    return yield* new PostHogDeletionRequestError({
      code: postHogDeletionRequestErrorCode,
      message: "PostHog could not delete every matched person.",
    });
  }
});

/** Convex action boundary for durable deleted-user analytics erasure. */
export const cleanupDeletedUserAnalytics = internalAction({
  args: {
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (_ctx, args) => {
    await runConvexProgram(deletePostHogPerson(args.userId));
    return null;
  },
});
