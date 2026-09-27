"use node";

import type { WelcomeIntentInput } from "@repo/backend/confect/emails/welcome/input";
import type { WelcomeIntentError } from "@repo/backend/confect/emails/welcome/spec";
import { renderAccountReadyEmail } from "@repo/email/templates/ready/email";
import { Effect } from "effect";
export const deliverWelcomeEmailProgram = Effect.fn("emails.welcome.deliver")(
  function* (
    readInput: Effect.Effect<WelcomeIntentInput, WelcomeIntentError>,
    enqueue: (message: {
      readonly html: string;
      readonly subject: string;
      readonly text: string;
    }) => Effect.Effect<null, WelcomeIntentError>
  ) {
    const input = yield* readInput;
    if (!input) {
      return null;
    }
    const message = yield* renderAccountReadyEmail({
      continueUrl: input.continueUrl,
      locale: input.locale,
      privacyPolicyUrl: input.privacyPolicyUrl,
      termsOfServiceUrl: input.termsOfServiceUrl,
    });
    yield* enqueue(message);
    return null;
  }
);
