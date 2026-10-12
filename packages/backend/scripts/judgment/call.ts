import { Ref } from "@confect/core";
import refs from "@repo/backend/confect/_generated/refs";
import { getUnknownErrorMessage } from "@repo/backend/confect/failure";
import type { JudgmentName } from "@repo/backend/confect/nina/judgment/catalog";
import { Measurement } from "@repo/backend/confect/nina/judgment.spec";
import { FetchClient } from "@repo/utilities/http/client";
import { getFunctionName } from "convex/server";
import { Array as Arr, Duration, Effect, Schema } from "effect";
import {
  HttpClient,
  type HttpClientError,
  HttpClientRequest,
} from "effect/http";

/**
 * How long one measuring call may take. It asks the gateway about up to 30
 * texts, a few at a time, so it takes seconds; this is the backstop for a call
 * that never answers.
 */
const CALL_DEADLINE = Duration.seconds(60);

/** Why a measuring call failed: the deployment, the network, or an answer the command cannot read. */
export class JudgmentCallError extends Schema.TaggedError<JudgmentCallError>()(
  "JudgmentCallError",
  { message: Schema.String }
) {}

/** The answer of Convex's admin API for an action: its value, or the message of its failure. */
const Reply = Schema.Union([
  Schema.Struct({ status: Schema.Literal("success"), value: Measurement }),
  Schema.Struct({
    errorMessage: Schema.optionalKey(Schema.String),
    status: Schema.Literal("error"),
  }),
]);

/** Reports why Convex could not be reached or read, in the words of its cause. */
const failedToReach = (error: HttpClientError.HttpClientError) =>
  new JudgmentCallError({
    message: getUnknownErrorMessage(error.reason.cause),
  });

/**
 * Runs the measuring action of a deployment on some texts, through Convex's
 * admin HTTP API with the credential `config` holds, and answers with its
 * measurement of the named judgments. The deployment is the one `config` names,
 * so a caller chooses it by the environment it configures; this call never
 * picks production. An answer that holds more or fewer rows than the texts it
 * was given is refused, because a row that matched no text would be matched
 * with the wrong one.
 */
export const callMeasure = Effect.fn("judgment.callMeasure")(
  function* (
    config: { readonly accessToken: string; readonly url: string },
    names: Arr.NonEmptyReadonlyArray<JudgmentName>,
    texts: readonly string[],
    together: number
  ) {
    const path = getFunctionName(
      Ref.getFunctionReference(refs.internal.nina.judgment.measure)
    );
    const client = yield* HttpClient.HttpClient;
    const response = yield* HttpClientRequest.post(
      `${config.url}/api/action`
    ).pipe(
      HttpClientRequest.setHeader(
        "Authorization",
        `Convex ${config.accessToken}`
      ),
      HttpClientRequest.bodyJsonUnsafe({
        args: { names, texts, together },
        format: "json",
        path,
      }),
      client.execute,
      Effect.mapError(failedToReach)
    );
    if (response.status < 200 || response.status >= 300) {
      return yield* new JudgmentCallError({
        message: `${path}: HTTP ${response.status}`,
      });
    }
    const body = yield* response.json.pipe(Effect.mapError(failedToReach));
    const reply = yield* Schema.decodeUnknownEffect(Reply)(body).pipe(
      Effect.mapError(
        () =>
          new JudgmentCallError({
            message: `${path}: the answer is not what the command reads`,
          })
      )
    );
    if (reply.status === "error") {
      return yield* new JudgmentCallError({
        message: `${path}: ${reply.errorMessage ?? "Unknown Convex error"}`,
      });
    }
    if (Arr.length(reply.value.rows) !== Arr.length(texts)) {
      return yield* new JudgmentCallError({
        message: `${path}: the deployment measured ${Arr.length(reply.value.rows)} of ${Arr.length(texts)} texts`,
      });
    }
    return reply.value;
  },
  // The deadline covers the send and the read, so a stalled answer ends.
  Effect.timeoutOrElse({
    duration: CALL_DEADLINE,
    orElse: () =>
      Effect.fail(
        new JudgmentCallError({
          message: `Convex did not answer within ${Duration.toSeconds(CALL_DEADLINE)} seconds.`,
        })
      ),
  }),
  Effect.provide(FetchClient)
);
