import { env, internalAction } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { Effect, Schema } from "effect";

const postHogDeletionConfigErrorCode = "POSTHOG_DELETION_CONFIG_INVALID";
const postHogDeletionRequestErrorCode = "POSTHOG_DELETION_REQUEST_FAILED";
const defaultPostHogIngestionHost = "https://us.i.posthog.com";
const postHogIngestionHostnameSuffix = /\.i\.posthog\.com$/;

interface PostHogDeletionConfig {
  readonly host: string;
  readonly personalApiKey: string;
  readonly projectToken: string;
}

interface PostHogDeletionOptions {
  readonly config: PostHogDeletionConfig;
  readonly request: typeof fetch;
}

interface ValidPostHogDeletionConfig {
  readonly apiOrigin: string;
  readonly personalApiKey: string;
  readonly projectToken: string;
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

function getPostHogApiOrigin(host: string) {
  const url = new URL(host);
  url.hostname = url.hostname.replace(
    postHogIngestionHostnameSuffix,
    ".posthog.com"
  );
  return url.origin;
}

function getDefaultPostHogDeletionConfig(): PostHogDeletionConfig {
  return {
    host: env.POSTHOG_HOST ?? defaultPostHogIngestionHost,
    personalApiKey: env.POSTHOG_ACCOUNT_DELETION_API_KEY,
    projectToken: env.POSTHOG_PROJECT_TOKEN,
  };
}

/** Validates and normalizes the credentials required before identity removal. */
const validatePostHogDeletionConfig = Effect.fn(
  "analytics.deletion.validatePostHogDeletionConfig"
)(function* (config: PostHogDeletionConfig) {
  const personalApiKey = config.personalApiKey.trim();
  const projectToken = config.projectToken.trim();

  if (!(personalApiKey && projectToken)) {
    return yield* new PostHogDeletionConfigError({
      code: postHogDeletionConfigErrorCode,
      message: "PostHog person deletion credentials are not configured.",
    });
  }

  const apiOrigin = yield* Effect.try({
    try: () => getPostHogApiOrigin(config.host),
    catch: () =>
      new PostHogDeletionConfigError({
        code: postHogDeletionConfigErrorCode,
        message: "PostHog deletion host is invalid.",
      }),
  });

  return {
    apiOrigin,
    personalApiKey,
    projectToken,
  } satisfies ValidPostHogDeletionConfig;
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
  const { apiOrigin, personalApiKey, projectToken } =
    yield* validatePostHogDeletionConfig(options.config);
  const endpoint = `${apiOrigin}/api/projects/@current/persons/bulk_delete/?token=${encodeURIComponent(projectToken)}`;
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
          Authorization: `Bearer ${personalApiKey}`,
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
