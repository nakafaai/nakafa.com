import {
  AccountReadyEmail,
  renderAccountReadyEmail,
} from "@repo/email/templates/ready/email";
import { Effect, Schema } from "effect";

export interface WelcomeProps {
  readonly name: string;
  readonly privacyPolicyUrl: string;
  readonly startLearningUrl: string;
  readonly termsOfServiceUrl: string;
}

/** Typed failure for the retiring welcome-email delivery contract. */
export class WelcomeEmailRenderError extends Schema.TaggedError<WelcomeEmailRenderError>()(
  "WelcomeEmailRenderError",
  {
    code: Schema.Literal("WELCOME_EMAIL_RENDER_FAILED"),
    message: Schema.String,
  }
) {}

/**
 * Preserves the in-flight welcome action's prop contract without rendering PII.
 * New delivery uses the account-ready renderer directly.
 */
export function Welcome({
  privacyPolicyUrl,
  startLearningUrl,
  termsOfServiceUrl,
}: WelcomeProps) {
  return (
    <AccountReadyEmail
      continueUrl={startLearningUrl}
      locale="en"
      privacyPolicyUrl={privacyPolicyUrl}
      termsOfServiceUrl={termsOfServiceUrl}
    />
  );
}

/** Renders the privacy-safe body while retaining the in-flight result shape. */
export const renderWelcomeEmail = Effect.fn("email.welcome.render")(function* (
  props: WelcomeProps
) {
  const message = yield* renderAccountReadyEmail({
    continueUrl: props.startLearningUrl,
    locale: "en",
    privacyPolicyUrl: props.privacyPolicyUrl,
    termsOfServiceUrl: props.termsOfServiceUrl,
  }).pipe(
    Effect.mapError(
      () =>
        new WelcomeEmailRenderError({
          code: "WELCOME_EMAIL_RENDER_FAILED",
          message: "Unable to render the welcome email.",
        })
    )
  );

  return { html: message.html, text: message.text };
});

Welcome.PreviewProps = {
  name: "not-rendered",
  privacyPolicyUrl: "https://nakafa.com/en/privacy-policy",
  startLearningUrl: "https://nakafa.com/en",
  termsOfServiceUrl: "https://nakafa.com/en/terms-of-service",
} satisfies WelcomeProps;

export default Welcome;
