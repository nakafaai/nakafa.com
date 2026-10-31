import { render } from "@react-email/render";
import { Layout } from "@repo/email/layout";
import {
  type DigestEmailInput,
  DigestEmailInputSchema,
  getDigestEmailCopy,
} from "@repo/email/templates/digest/content";
import {
  DigestEmailInputError,
  DigestEmailRenderError,
} from "@repo/email/templates/digest/contract";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Effect, Schema } from "effect";

const siteUrl = new URL(SITE_ORIGIN);

const digestEmailPreviewInput = {
  counts: [
    { change: "grade.released", count: 1 },
    { change: "assignment.published", count: 3 },
  ],
  inboxUrl: new URL(
    `${siteUrl.protocol}//harapan.${siteUrl.host}/notifications`
  ).href,
  locale: "en",
  privacyPolicyUrl: new URL("/en/privacy-policy", SITE_ORIGIN).href,
  termsOfServiceUrl: new URL("/en/terms-of-service", SITE_ORIGIN).href,
} satisfies DigestEmailInput;

/** Renders one notice mail for one supported locale. */
function DigestEmail(input: DigestEmailInput = digestEmailPreviewInput) {
  const { counts, inboxUrl, locale, privacyPolicyUrl, termsOfServiceUrl } = {
    ...digestEmailPreviewInput,
    ...input,
  };
  return (
    <Layout
      copy={getDigestEmailCopy({ counts, locale })}
      ctaUrl={inboxUrl}
      locale={locale}
      privacyPolicyUrl={privacyPolicyUrl}
      termsOfServiceUrl={termsOfServiceUrl}
    />
  );
}

/** Renders localized HTML and text of the digest email. */
export const renderDigestEmail = Effect.fn("email.digest.render")(function* (
  input: DigestEmailInput
) {
  const props = yield* Schema.decodeEffect(DigestEmailInputSchema)(input).pipe(
    Effect.mapError(
      () =>
        new DigestEmailInputError({
          code: "DIGEST_EMAIL_INPUT_INVALID",
          message: "Digest email input is invalid.",
        })
    )
  );
  const copy = getDigestEmailCopy(props);
  const renderFailure = () =>
    new DigestEmailRenderError({
      code: "DIGEST_EMAIL_RENDER_FAILED",
      message: "Unable to render the digest email.",
    });
  const [html, text] = yield* Effect.all(
    [
      Effect.tryPromise({
        catch: renderFailure,
        try: () => render(<DigestEmail {...props} />),
      }),
      Effect.tryPromise({
        catch: renderFailure,
        try: () => render(<DigestEmail {...props} />, { plainText: true }),
      }),
    ],
    { concurrency: "unbounded" }
  );
  return { html, subject: copy.subject, text };
});
DigestEmail.PreviewProps = digestEmailPreviewInput;
export default DigestEmail;
