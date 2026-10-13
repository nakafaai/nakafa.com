import { render } from "@react-email/render";
import { Layout } from "@repo/email/layout";
import {
  type AccountReadyEmailInput,
  AccountReadyEmailInputSchema,
  getAccountReadyEmailCopy,
} from "@repo/email/templates/ready/content";
import {
  AccountReadyEmailInputError,
  AccountReadyEmailRenderError,
} from "@repo/email/templates/ready/contract";
import { getPublicEmailUrl } from "@repo/email/url";
import { Effect, Schema } from "effect";

const accountReadyEmailPreviewInput = {
  continueUrl: getPublicEmailUrl("/en/home"),
  locale: "en",
  privacyPolicyUrl: getPublicEmailUrl("/en/privacy-policy"),
  termsOfServiceUrl: getPublicEmailUrl("/en/terms-of-service"),
} satisfies AccountReadyEmailInput;

/** Renders the privacy-safe account-ready message for one supported locale. */
function AccountReadyEmail(
  input: AccountReadyEmailInput = accountReadyEmailPreviewInput
) {
  const { continueUrl, locale, privacyPolicyUrl, termsOfServiceUrl } = {
    ...accountReadyEmailPreviewInput,
    ...input,
  };
  return (
    <Layout
      copy={getAccountReadyEmailCopy(locale)}
      ctaUrl={continueUrl}
      locale={locale}
      privacyPolicyUrl={privacyPolicyUrl}
      termsOfServiceUrl={termsOfServiceUrl}
    />
  );
}

/** Renders localized HTML and text from the permanent account-ready source. */
export const renderAccountReadyEmail = Effect.fn("email.accountReady.render")(
  function* (input: AccountReadyEmailInput) {
    const props = yield* Schema.decodeEffect(AccountReadyEmailInputSchema)(
      input
    ).pipe(
      Effect.mapError(
        () =>
          new AccountReadyEmailInputError({
            code: "ACCOUNT_READY_EMAIL_INPUT_INVALID",
            message: "Account-ready email input is invalid.",
          })
      )
    );
    const copy = getAccountReadyEmailCopy(props.locale);
    const email = <AccountReadyEmail {...props} />;
    const renderFailure = () =>
      new AccountReadyEmailRenderError({
        code: "ACCOUNT_READY_EMAIL_RENDER_FAILED",
        message: "Unable to render the account-ready email.",
      });
    const [html, text] = yield* Effect.all(
      [
        Effect.tryPromise({
          catch: renderFailure,
          try: () => render(email),
        }),
        Effect.tryPromise({
          catch: renderFailure,
          try: () =>
            render(email, {
              plainText: true,
            }),
        }),
      ],
      {
        concurrency: "unbounded",
      }
    );
    return {
      html,
      subject: copy.subject,
      text,
    };
  }
);
AccountReadyEmail.PreviewProps = accountReadyEmailPreviewInput;
export default AccountReadyEmail;
