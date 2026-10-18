import { render } from "@react-email/render";
import { Layout } from "@repo/email/layout";
import {
  getInviteEmailCopy,
  type InviteEmailInput,
  InviteEmailInputSchema,
} from "@repo/email/templates/invite/content";
import {
  InviteEmailInputError,
  InviteEmailRenderError,
} from "@repo/email/templates/invite/contract";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Effect, Schema } from "effect";

const siteUrl = new URL(SITE_ORIGIN);

const inviteEmailPreviewInput = {
  locale: "en",
  organisation: "Harapan Bangsa Foundation",
  privacyPolicyUrl: new URL("/en/privacy-policy", SITE_ORIGIN).href,
  signInUrl: new URL(`${siteUrl.protocol}//harapan.${siteUrl.host}/`).href,
  termsOfServiceUrl: new URL("/en/terms-of-service", SITE_ORIGIN).href,
} satisfies InviteEmailInput;

/** Renders the invitation to open one organisation on Nakafa for one supported locale. */
function InviteEmail(input: InviteEmailInput = inviteEmailPreviewInput) {
  const {
    locale,
    organisation,
    privacyPolicyUrl,
    signInUrl,
    termsOfServiceUrl,
  } = {
    ...inviteEmailPreviewInput,
    ...input,
  };
  return (
    <Layout
      copy={getInviteEmailCopy(locale, organisation)}
      ctaUrl={signInUrl}
      locale={locale}
      privacyPolicyUrl={privacyPolicyUrl}
      termsOfServiceUrl={termsOfServiceUrl}
    />
  );
}

/** Renders localized HTML and text of the invitation email. */
export const renderInviteEmail = Effect.fn("email.invite.render")(function* (
  input: InviteEmailInput
) {
  const props = yield* Schema.decodeEffect(InviteEmailInputSchema)(input).pipe(
    Effect.mapError(
      () =>
        new InviteEmailInputError({
          code: "INVITE_EMAIL_INPUT_INVALID",
          message: "Invitation email input is invalid.",
        })
    )
  );
  const copy = getInviteEmailCopy(props.locale, props.organisation);
  const email = <InviteEmail {...props} />;
  const renderFailure = () =>
    new InviteEmailRenderError({
      code: "INVITE_EMAIL_RENDER_FAILED",
      message: "Unable to render the invitation email.",
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
});
InviteEmail.PreviewProps = inviteEmailPreviewInput;
export default InviteEmail;
