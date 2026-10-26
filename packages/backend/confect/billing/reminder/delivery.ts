"use node";

import type { PassReminderInput } from "@repo/backend/confect/billing/reminder/internal.spec";
import { renderPassEndingEmail } from "@repo/email/templates/pass/email";
import { Effect } from "effect";

/**
 * Reads what one pass reminder says, writes the day the pass ends in the
 * learner's language and in Jakarta's calendar, the zone the settings show it
 * in, renders the message, and hands it to the send step. A reminder that no
 * longer applies reads as nothing and sends nothing.
 */
export const deliverPassReminderProgram = Effect.fn("billing.reminder.deliver")(
  function* <E1, E2>(
    readInput: Effect.Effect<typeof PassReminderInput.Type | null, E1>,
    enqueue: (message: {
      readonly html: string;
      readonly subject: string;
      readonly text: string;
    }) => Effect.Effect<null, E2>
  ) {
    const input = yield* readInput;
    if (input === null) {
      return null;
    }
    const message = yield* renderPassEndingEmail({
      endsOn: new Intl.DateTimeFormat(input.locale, {
        dateStyle: "long",
        timeZone: "Asia/Jakarta",
      }).format(input.endsAt),
      extendUrl: input.extendUrl,
      locale: input.locale,
      privacyPolicyUrl: input.privacyPolicyUrl,
      termsOfServiceUrl: input.termsOfServiceUrl,
    });
    yield* enqueue(message);
    return null;
  }
);
