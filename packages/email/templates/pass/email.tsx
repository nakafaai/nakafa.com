import { render } from "@react-email/render";
import { Layout } from "@repo/email/layout";
import {
  getPassEndingEmailCopy,
  type PassEndingEmailInput,
  PassEndingEmailInputSchema,
} from "@repo/email/templates/pass/content";
import {
  PassEndingEmailInputError,
  PassEndingEmailRenderError,
} from "@repo/email/templates/pass/contract";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Effect, Schema } from "effect";

const passEndingEmailPreviewInput = {
  endsOn: "26 November 2026",
  extendUrl: new URL("/en/user/settings/subscriptions", SITE_ORIGIN).href,
  locale: "en",
  privacyPolicyUrl: new URL("/en/privacy-policy", SITE_ORIGIN).href,
  termsOfServiceUrl: new URL("/en/terms-of-service", SITE_ORIGIN).href,
} satisfies PassEndingEmailInput;

/** Renders the reminder that a learner's Pro pass ends soon, for one supported locale. */
function PassEndingEmail(
  input: PassEndingEmailInput = passEndingEmailPreviewInput
) {
  const { endsOn, extendUrl, locale, privacyPolicyUrl, termsOfServiceUrl } = {
    ...passEndingEmailPreviewInput,
    ...input,
  };
  return (
    <Layout
      copy={getPassEndingEmailCopy(locale, endsOn)}
      ctaUrl={extendUrl}
      locale={locale}
      privacyPolicyUrl={privacyPolicyUrl}
      termsOfServiceUrl={termsOfServiceUrl}
    />
  );
}

/** Renders localized HTML and text of the pass reminder. */
export const renderPassEndingEmail = Effect.fn("email.passEnding.render")(
  function* (input: PassEndingEmailInput) {
    const props = yield* Schema.decodeEffect(PassEndingEmailInputSchema)(
      input
    ).pipe(
      Effect.mapError(
        () =>
          new PassEndingEmailInputError({
            code: "PASS_ENDING_EMAIL_INPUT_INVALID",
            message: "Pass reminder email input is invalid.",
          })
      )
    );
    const copy = getPassEndingEmailCopy(props.locale, props.endsOn);
    const email = <PassEndingEmail {...props} />;
    const renderFailure = () =>
      new PassEndingEmailRenderError({
        code: "PASS_ENDING_EMAIL_RENDER_FAILED",
        message: "Unable to render the pass reminder email.",
      });
    const [html, text] = yield* Effect.all(
      [
        Effect.tryPromise({
          catch: renderFailure,
          try: () => render(email),
        }),
        Effect.tryPromise({
          catch: renderFailure,
          try: () => render(email, { plainText: true }),
        }),
      ],
      { concurrency: "unbounded" }
    );
    return { html, subject: copy.subject, text };
  }
);
PassEndingEmail.PreviewProps = passEndingEmailPreviewInput;
export default PassEndingEmail;
