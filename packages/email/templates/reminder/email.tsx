import { render } from "@react-email/render";
import { Layout } from "@repo/email/layout";
import {
  getReminderEmailCopy,
  type ReminderEmailInput,
  ReminderEmailInputSchema,
} from "@repo/email/templates/reminder/content";
import {
  ReminderEmailInputError,
  ReminderEmailRenderError,
} from "@repo/email/templates/reminder/contract";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Effect, Schema } from "effect";

const reminderEmailPreviewInput = {
  continueUrl: new URL(
    "/en/try-out/indonesia/tka/compulsory-mathematics/set-1",
    SITE_ORIGIN
  ).href,
  hoursLeft: 6,
  locale: "en",
  privacyPolicyUrl: new URL("/en/privacy-policy", SITE_ORIGIN).href,
  setTitle: "Compulsory Mathematics Set 1",
  termsOfServiceUrl: new URL("/en/terms-of-service", SITE_ORIGIN).href,
  unsubscribeUrl: new URL("/en/unsubscribe?token=preview", SITE_ORIGIN).href,
  variant: "a",
} satisfies ReminderEmailInput;

/** Renders the reminder that a learner's running try-out ends soon, for one supported locale. */
function ReminderEmail(input: ReminderEmailInput = reminderEmailPreviewInput) {
  const {
    continueUrl,
    hoursLeft,
    locale,
    privacyPolicyUrl,
    setTitle,
    termsOfServiceUrl,
    unsubscribeUrl,
    variant,
  } = {
    ...reminderEmailPreviewInput,
    ...input,
  };
  return (
    <Layout
      copy={getReminderEmailCopy(locale, { hoursLeft, setTitle, variant })}
      ctaUrl={continueUrl}
      locale={locale}
      privacyPolicyUrl={privacyPolicyUrl}
      termsOfServiceUrl={termsOfServiceUrl}
      unsubscribeUrl={unsubscribeUrl}
    />
  );
}

/** Renders localized HTML and text of the try-out reminder. */
export const renderReminderEmail = Effect.fn("email.reminder.render")(
  function* (input: ReminderEmailInput) {
    const props = yield* Schema.decodeEffect(ReminderEmailInputSchema)(
      input
    ).pipe(
      Effect.mapError(
        () =>
          new ReminderEmailInputError({
            code: "REMINDER_EMAIL_INPUT_INVALID",
            message: "Try-out reminder email input is invalid.",
          })
      )
    );
    const copy = getReminderEmailCopy(props.locale, props);
    const renderFailure = () =>
      new ReminderEmailRenderError({
        code: "REMINDER_EMAIL_RENDER_FAILED",
        message: "Unable to render the try-out reminder email.",
      });
    const [html, text] = yield* Effect.all(
      [
        Effect.tryPromise({
          catch: renderFailure,
          try: () => render(<ReminderEmail {...props} />),
        }),
        Effect.tryPromise({
          catch: renderFailure,
          try: () => render(<ReminderEmail {...props} />, { plainText: true }),
        }),
      ],
      { concurrency: "unbounded" }
    );
    return { html, subject: copy.subject, text };
  }
);
ReminderEmail.PreviewProps = reminderEmailPreviewInput;
export default ReminderEmail;
