import {
  compareInputValidator,
  compareResultValidator,
} from "@repo/backend/confect/contents/sections/compare.spec";
import { getUnknownErrorMessage } from "@repo/backend/confect/failure";
import type { getCustomerConvexConfig } from "@repo/backend/scripts/customers/convex";
import { FetchClient } from "@repo/utilities/http/client";
import { encodeJsonText } from "@repo/utilities/json";
import { Duration, Effect, Schema } from "effect";
import {
  HttpClient,
  type HttpClientError,
  HttpClientRequest,
} from "effect/http";

/**
 * The longest a deployment may take to embed the stored sections of one
 * language and the questions with one model. The runtime of Node, which makes
 * the request, gives up on a request that gets no answer after five minutes.
 */
const RANK_DEADLINE_MINUTES = 5;

/**
 * Where the model comparison lives in a deployment: its module and its export.
 * The script cannot load the generated references, because they load every
 * function of the backend, so it names the function and takes the shape of its
 * arguments and answer from the contract that the function declares. A test
 * holds this path to the name that the references give the function.
 */
const RANK_PATH = "contents/sections/compare:rank";

/** Why a call to the deployment did not give an answer, in the words of its cause. */
class KnowledgeConvexError extends Schema.TaggedError<KnowledgeConvexError>()(
  "KnowledgeConvexError",
  { message: Schema.String }
) {}

/**
 * The envelope in which Convex's HTTP API answers a function call. A typed
 * failure of the function, such as the gateway refusing a request, comes as
 * `errorData`.
 */
const AnswerSchema = Schema.Struct({
  errorData: Schema.optional(Schema.Unknown),
  errorMessage: Schema.optional(Schema.String),
  status: Schema.Literals(["success", "error"]),
  value: Schema.optional(Schema.Unknown),
});

const failed = (cause: unknown) =>
  new KnowledgeConvexError({ message: getUnknownErrorMessage(cause) });

/** The failure of the HTTP client to send the request or to read the answer. */
const unreadable = (error: HttpClientError.HttpClientError) =>
  failed(error.reason.cause);

/**
 * Runs the model comparison of a deployment for one model and one language,
 * through Convex's admin HTTP API, and gives back its answer as the function
 * declares it. The function is internal, so only an admin credential reaches it.
 */
export const rankModel = Effect.fn("knowledge.rankModel")(
  function* (
    config: Effect.Success<ReturnType<typeof getCustomerConvexConfig>>,
    input: typeof compareInputValidator.Type
  ) {
    const client = yield* HttpClient.HttpClient;
    const args = yield* Schema.encodeEffect(compareInputValidator)(input).pipe(
      Effect.orDie
    );
    const response = yield* HttpClientRequest.post(
      `${config.url}/api/action`
    ).pipe(
      HttpClientRequest.setHeader(
        "Authorization",
        `Convex ${config.accessToken}`
      ),
      HttpClientRequest.bodyJsonUnsafe({
        args,
        format: "json",
        path: RANK_PATH,
      }),
      client.execute,
      Effect.mapError(unreadable)
    );
    if (response.status < 200 || response.status >= 300) {
      const body = yield* response.text.pipe(Effect.mapError(unreadable));
      return yield* new KnowledgeConvexError({
        message: `HTTP ${response.status} ${body}`,
      });
    }
    const body = yield* response.json.pipe(Effect.mapError(unreadable));
    const answer = yield* Schema.decodeUnknownEffect(AnswerSchema)(body).pipe(
      Effect.mapError(failed)
    );
    if (answer.status === "error") {
      const reason = answer.errorMessage ?? "Unknown Convex error";
      return yield* new KnowledgeConvexError({
        message:
          answer.errorData === undefined
            ? reason
            : `${reason} ${encodeJsonText(answer.errorData)}`,
      });
    }
    return yield* Schema.decodeUnknownEffect(compareResultValidator)(
      answer.value
    ).pipe(Effect.mapError(failed));
  },
  // The deadline covers the send and the JSON read, so a stalled answer ends.
  Effect.timeoutOrElse({
    duration: Duration.minutes(RANK_DEADLINE_MINUTES),
    orElse: () =>
      Effect.fail(
        new KnowledgeConvexError({
          message: `The deployment did not answer within ${RANK_DEADLINE_MINUTES} minutes.`,
        })
      ),
  }),
  Effect.provide(FetchClient)
);
