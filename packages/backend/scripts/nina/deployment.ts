import { NinaReceipt } from "@repo/backend/client/nina/receipt";
import type { NinaInput } from "@repo/backend/confect/nina/turns.spec";
import { api, internal } from "@repo/backend/convex/_generated/api";
import { createLearnerAccount } from "@repo/backend/scripts/content/acceptance/account";
import type { RunConvex } from "@repo/backend/scripts/content/acceptance/convex";
import { sanitizeAcceptanceCommandError } from "@repo/backend/scripts/content/acceptance/error";
import { gateError, NinaGateError } from "@repo/backend/scripts/nina/error";
import { GateTurn, StoredMessage } from "@repo/backend/scripts/nina/verdict";
import { randomUuid } from "@repo/utilities/uuid";
import { getFunctionName } from "convex/server";
import { Context, Duration, Effect, Schema } from "effect";
import { SecureRandom } from "effect/crypto";

/** Outlasts the longest turn and its follow-up and nothing more: the learner is removed after. */
const SESSION_LIFETIME = Duration.minutes(30);

/** A synthetic learner that is signed in: the Better Auth user and the session it acts under. */
const Learner = Schema.Struct({
  authId: Schema.String,
  sessionId: Schema.String,
});
type Learner = typeof Learner.Type;

/** What `nina/conversation:get` returns that the gate reads: the newest turn of the chat, if it has one. */
const Conversation = Schema.Struct({ turn: Schema.NullOr(GateTurn) });

/** What the Agent component lists of a thread: a page of its messages. */
const Journal = Schema.Struct({ page: Schema.Array(StoredMessage) });

/** The messages of one gate chat, which holds one turn, fit in a page of this size with room to spare. */
const JOURNAL_PAGE = 100;

/** The question as the `nina/turns:start` function takes it. */
export type Question = Extract<
  typeof NinaInput.Type,
  { readonly kind: "message" }
>;

/** The chat that a turn was asked in. */
type ChatId = typeof NinaReceipt.Type.chatId;

/**
 * The deployment the gate runs against, seen as what the gate does with it:
 * sign a synthetic learner in, ask a question as that learner, read the stored
 * turn and the Agent journal of its thread, and take the chat and the learner
 * away again.
 */
export class Deployment extends Context.Service<
  Deployment,
  {
    readonly signIn: Effect.Effect<Learner, NinaGateError>;
    readonly ask: (
      learner: Learner,
      question: Question
    ) => Effect.Effect<typeof NinaReceipt.Type, NinaGateError>;
    readonly read: (
      learner: Learner,
      chatId: ChatId
    ) => Effect.Effect<GateTurn, NinaGateError>;
    readonly journal: (
      threadId: string
    ) => Effect.Effect<readonly StoredMessage[], NinaGateError>;
    readonly forget: (
      learner: Learner,
      chatId: ChatId
    ) => Effect.Effect<void, NinaGateError>;
    readonly retire: (learner: Learner) => Effect.Effect<void, NinaGateError>;
  }
>()("@repo/backend/scripts/nina/deployment") {}

/** Keeps a gate failure as it is, and gives any other failure of a step the gate's own type. */
function asGateError(step: string, error: { readonly message: string }) {
  return Schema.is(NinaGateError)(error)
    ? error
    : gateError(
        `${step}: ${sanitizeAcceptanceCommandError(error.message, [])}`
      );
}

/**
 * Decodes what a call answered. A failure names the step and what the decoder
 * expected, and never quotes the value, which may hold a session token or an
 * answer: Effect keeps the input out of a decode error unless the decode asks it
 * to report the input, and this one does not.
 */
const readAnswer = Effect.fn("ninaGate.readAnswer")(function* <A, I>(
  step: string,
  schema: Schema.Codec<A, I, never, never>,
  answered: unknown
) {
  return yield* Schema.decodeUnknownEffect(schema)(answered).pipe(
    Effect.mapError((error) => asGateError(step, error))
  );
});

/**
 * Builds the deployment over `run`, which reaches a real deployment or a
 * double. The functions are named through the generated API, so a rename breaks
 * the compiler and not the gate. A learner acts through an identity that the
 * runner signs with the caller's own admin rights. The session middleware
 * accepts it because the Better Auth user and session exist.
 */
export function makeDeployment(
  run: RunConvex<NinaGateError, never>,
  random: typeof SecureRandom.SecureRandom.Service
) {
  const callAs = (
    learner: Learner,
    step: string,
    functionName: string,
    args: unknown
  ) =>
    run(step, {
      args,
      identity: { sessionId: learner.sessionId, subject: learner.authId },
      path: functionName,
    });

  return Deployment.of({
    signIn: createLearnerAccount(run, SESSION_LIFETIME).pipe(
      Effect.provideService(SecureRandom.SecureRandom, random),
      Effect.map(({ sessionId, userId }) => ({ authId: userId, sessionId })),
      Effect.mapError((error) => asGateError("Learner account", error))
    ),
    ask: Effect.fn("ninaGate.ask")(function* (
      learner: Learner,
      question: Question
    ) {
      const answered = yield* callAs(
        learner,
        "Nina turn",
        getFunctionName(api.nina.turns.start),
        { input: question, requestId: yield* randomUuid }
      );
      return yield* readAnswer("Nina turn", NinaReceipt, answered);
    }),
    read: Effect.fn("ninaGate.read")(function* (
      learner: Learner,
      chatId: ChatId
    ) {
      const answered = yield* callAs(
        learner,
        "Stored turn",
        getFunctionName(api.nina.conversation.get),
        { chatId }
      );
      const { turn } = yield* readAnswer("Stored turn", Conversation, answered);
      return yield* Effect.fromNullishOr(turn).pipe(
        Effect.mapError(() => gateError("The chat holds no turn."))
      );
    }),
    // The journal belongs to the Agent component, which knows no learner. The
    // runner reads it with the caller's own admin rights, like the other rows.
    journal: Effect.fn("ninaGate.journal")(function* (threadId: string) {
      const answered = yield* run("Agent journal", {
        args: {
          order: "asc",
          paginationOpts: { cursor: null, numItems: JOURNAL_PAGE },
          threadId,
        },
        component: "nina",
        path: "messages:listMessagesByThreadId",
      });
      const { page } = yield* readAnswer("Agent journal", Journal, answered);
      return page;
    }),
    forget: Effect.fn("ninaGate.forget")(function* (
      learner: Learner,
      chatId: ChatId
    ) {
      yield* callAs(
        learner,
        "Chat removal",
        getFunctionName(api.chats.mutations.deleteChat),
        { chatId }
      );
    }),
    // The claim is the call that Better Auth's before-delete hook makes, with a
    // fresh UUID as the attempt id the hook requires. It skips the hook's check
    // that PostHog erasure is configured, which an admin call cannot run. The account
    // recovery sweep then deletes the learner and every row the app keeps.
    retire: Effect.fn("ninaGate.retire")(function* (learner: Learner) {
      const answered = yield* run("Learner removal", {
        args: { attemptId: yield* randomUuid, authId: learner.authId },
        path: getFunctionName(internal.auth.deletion.claimAccountDeletion),
      });
      const outcome = yield* readAnswer(
        "Learner removal",
        Schema.String,
        answered
      );
      if (outcome !== "ready") {
        return yield* gateError(
          `Learner removal answered ${outcome} instead of ready.`
        );
      }
    }),
  });
}
