import { NETWORK_ATTEMPT_DEADLINE } from "@repo/backend/client/network";
import {
  PostHogErasureConfigError,
  PostHogErasureRequestError,
  postHogErasureConfigErrorCode,
  postHogErasureRequestErrorCode,
} from "@repo/backend/confect/analytics/erasure/action.spec";
import { JsonTextSchema } from "@repo/utilities/json";
import { Config, Effect, Redacted, Schema } from "effect";
export const postHogIngestionHostnameSuffix = /\.i\.posthog\.com$/;
export const postHogProjectIdPattern = /^[1-9]\d*$/;
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
const PostHogErasureConfigSchema = Schema.Struct({
  deletionApiKey: Schema.String,
  host: Schema.String,
  projectId: Schema.String,
});
export type PostHogErasureConfig = typeof PostHogErasureConfigSchema.Type;
const PostHogBulkEraseJsonSchema = Schema.fromJsonString(
  PostHogBulkEraseResponseSchema
);

/** One erasure answer: its status and, for a success, its body text. */
const ErasureAnswerSchema = Schema.Struct({
  ok: Schema.Boolean,
  status: Schema.Finite,
  text: Schema.UndefinedOr(Schema.String),
});

/**
 * Reads one erasure answer: its status, and for a success its body text. A body
 * that cannot be read leaves the text undefined, so decoding reports the answer
 * as an invalid response.
 */
function readErasureAnswer(
  response: Response
): Promise<typeof ErasureAnswerSchema.Type> {
  if (!response.ok) {
    return Promise.resolve({
      ok: false,
      status: response.status,
      text: undefined,
    });
  }
  return response.text().then(
    (text) => ({ ok: true, status: response.status, text }),
    () => ({ ok: true, status: response.status, text: undefined })
  );
}

/** Reads named Convex settings without exposing credentials in decode errors. */
const readPostHogErasureConfig = Effect.fn(
  "analytics.erasure.readPostHogErasureConfig"
)(function* () {
  const config = yield* Config.all({
    deletionApiKey: Config.schema(
      Schema.Redacted(Schema.NonEmptyString),
      "POSTHOG_ERASURE_API_KEY"
    ),
    host: Config.schema(Schema.NonEmptyString, "POSTHOG_HOST"),
    projectId: Config.schema(Schema.NonEmptyString, "POSTHOG_PROJECT_ID"),
  }).pipe(
    Effect.mapError(
      () =>
        new PostHogErasureConfigError({
          code: postHogErasureConfigErrorCode,
          message: "PostHog person erasure credentials are not configured.",
        })
    )
  );
  return {
    ...config,
    deletionApiKey: Redacted.value(config.deletionApiKey),
  };
});

/** Validates and normalizes the credentials required before identity erasure. */
export const validatePostHogErasureConfig = Effect.fn(
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
)(function* (config?: PostHogErasureConfig) {
  yield* validatePostHogErasureConfig(
    config ?? (yield* readPostHogErasureConfig())
  );
});

/** Erases the PostHog person, historical events, and session recordings. */
export const erasePostHogPerson = Effect.fn(
  "analytics.erasure.erasePostHogPerson"
)(function* (
  distinctId: string,
  options?: {
    readonly config: PostHogErasureConfig;
    readonly request: typeof fetch;
  }
) {
  const config = options?.config ?? (yield* readPostHogErasureConfig());
  const request = options?.request ?? fetch;
  const { apiOrigin, deletionApiKey, projectId } =
    yield* validatePostHogErasureConfig(config);
  const endpoint = `${apiOrigin}/api/projects/${encodeURIComponent(projectId)}/persons/bulk_delete/`;
  const requestNotSent = () =>
    new PostHogErasureRequestError({
      code: postHogErasureRequestErrorCode,
      message: "PostHog person erasure request could not be sent.",
    });
  const requestTimedOut = () =>
    new PostHogErasureRequestError({
      code: postHogErasureRequestErrorCode,
      message: "PostHog person erasure request timed out.",
    });
  const body = yield* Schema.encodeEffect(JsonTextSchema)({
    delete_events: true,
    delete_recordings: true,
    distinct_ids: [distinctId],
    keep_person: false,
  }).pipe(Effect.orDie);
  // The signal belongs to the send and to the body read, so the deadline aborts
  // both and the socket closes with the request.
  const answer = yield* Effect.tryPromise({
    try: (signal) =>
      request(endpoint, {
        body,
        headers: {
          Authorization: `Bearer ${deletionApiKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        signal,
      }).then(readErasureAnswer),
    catch: requestNotSent,
  }).pipe(
    Effect.timeoutOrElse({
      duration: NETWORK_ATTEMPT_DEADLINE,
      orElse: () => Effect.fail(requestTimedOut()),
    })
  );
  if (!answer.ok) {
    return yield* new PostHogErasureRequestError({
      code: postHogErasureRequestErrorCode,
      message: `PostHog person erasure returned HTTP ${answer.status}.`,
    });
  }
  const result = yield* Schema.decodeUnknownEffect(PostHogBulkEraseJsonSchema)(
    answer.text
  ).pipe(
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
