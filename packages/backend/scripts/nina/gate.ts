import { purposes } from "@repo/backend/confect/gateway/purpose";
import { TURN_DEADLINE } from "@repo/backend/confect/nina/deadline";
import {
  Deployment,
  type Question,
} from "@repo/backend/scripts/nina/deployment";
import { gateError } from "@repo/backend/scripts/nina/error";
import { renderTable } from "@repo/backend/scripts/nina/table";
import {
  chatSteps,
  hasFollowUp,
  isOpen,
  judgeTurn,
} from "@repo/backend/scripts/nina/verdict";
import { SITE_ORIGIN } from "@repo/seo/origin";
import {
  Array as Arr,
  Context,
  Duration,
  Effect,
  Schedule,
  Schema,
} from "effect";

/**
 * A lesson the browser acceptance suite pins too, long enough that the prompt
 * with the page in it is cached. A link to Nakafa's own site starts Nina's first
 * step with the Nakafa capability, so the answer always needs a second step.
 */
const LESSON = {
  locale: "en",
  slug: "subjects/mathematics/exponential-logarithm/basic-concept",
} as const;

/** The one question of the gate. It holds no personal data and asks about the lesson it links. */
const QUESTION = {
  kind: "message",
  page: LESSON,
  prompt: {
    text: `Explain in two short sentences what a learner finds in this lesson: ${new URL(`/${LESSON.locale}/${LESSON.slug}`, SITE_ORIGIN).href}`,
  },
} satisfies Question;

/**
 * How long the gate waits. It reads the stored turn every `every`. It gives the
 * turn its deadline and one minute more for the polling and the clocks, and
 * gives the follow-up work after the answer the time of one suggestion step and
 * one title step, which run one after the other. A test sets all three small.
 */
export const Pace = Context.Reference("@repo/backend/scripts/nina/gate/Pace", {
  defaultValue: () => ({
    every: Duration.seconds(3),
    followUp: Duration.millis(
      purposes.suggestion.timeout.stepMs + purposes.presentation.timeout.stepMs
    ),
    settle: Duration.sum(TURN_DEADLINE, Duration.minutes(1)),
  }),
});

/** What the gate found: one sentence for each failure, none when the turn passes, and the table of what the turn used. */
const Report = Schema.Struct({
  failures: Schema.Array(Schema.String),
  table: Schema.String,
});
export type Report = typeof Report.Type;

/**
 * Runs the release gate: one real turn through the gateway, judged from the
 * stored turn and from the steps of the chat agent in the Agent journal. The
 * learner and the chat it makes are removed again, whatever the outcome. A
 * removal that fails is logged with what it leaves behind, and never changes
 * the verdict.
 */
export const runGate = Effect.fn("ninaGate.run")(function* () {
  const deployment = yield* Deployment;
  const pace = yield* Pace;
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const learner = yield* Effect.acquireRelease(
        deployment.signIn,
        (signedIn) =>
          deployment.retire(signedIn).pipe(
            Effect.catchTag("NinaGateError", (error) =>
              Effect.logWarning("The synthetic learner was not removed", {
                authId: signedIn.authId,
                reason: error.message,
              })
            )
          )
      );
      const receipt = yield* Effect.acquireRelease(
        deployment.ask(learner, QUESTION),
        ({ chatId }) =>
          deployment.forget(learner, chatId).pipe(
            Effect.catchTag("NinaGateError", (error) =>
              Effect.logWarning("The gate chat was not removed", {
                chatId,
                reason: error.message,
              })
            )
          )
      );
      const read = deployment.read(learner, receipt.chatId);
      const settled = yield* read.pipe(
        Effect.repeat({
          schedule: Schedule.spaced(pace.every),
          until: (stored) => !isOpen(stored),
        }),
        Effect.timeoutOrElse({
          duration: pace.settle,
          orElse: () =>
            Effect.fail(
              gateError(
                `The turn was still open after ${Duration.format(pace.settle)}.`
              )
            ),
        })
      );
      // The suggestions and then the title come after the answer, and each
      // records the usage of its call. They are optional, so the gate waits for
      // them a little and judges what it has.
      const turn =
        settled.state.status === "complete"
          ? yield* read.pipe(
              Effect.repeat({
                schedule: Schedule.spaced(pace.every),
                until: hasFollowUp,
              }),
              Effect.timeoutOrElse({
                duration: pace.followUp,
                orElse: () => read,
              })
            )
          : settled;
      const steps = chatSteps(yield* deployment.journal(receipt.threadId));
      return {
        failures: judgeTurn(turn, steps),
        table: renderTable(turn, steps),
      };
    })
  );
});

/** The text the gate prints: the table, then the verdict, with each failure on a line of its own. */
export function renderReport({ failures, table }: Report) {
  return Arr.join(
    Arr.isReadonlyArrayEmpty(failures)
      ? [table, "", "The gate passed."]
      : [
          table,
          "",
          "The gate failed:",
          ...Arr.map(failures, (failure) => `- ${failure}`),
        ],
    "\n"
  );
}
