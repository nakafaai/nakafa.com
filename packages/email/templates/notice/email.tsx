import { render } from "@react-email/render";
import { Layout } from "@repo/email/layout";
import {
  getNoticeEmailCopy,
  type NoticeEmailInput,
  NoticeEmailInputSchema,
} from "@repo/email/templates/notice/content";
import {
  NoticeEmailInputError,
  NoticeEmailRenderError,
} from "@repo/email/templates/notice/contract";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Effect, Schema } from "effect";

const siteUrl = new URL(SITE_ORIGIN);

const noticeEmailPreviewInput = {
  classUrl: new URL(
    `${siteUrl.protocol}//harapan.${siteUrl.host}/classes/fisika-x-1`
  ).href,
  locale: "en",
  privacyPolicyUrl: new URL("/en/privacy-policy", SITE_ORIGIN).href,
  termsOfServiceUrl: new URL("/en/terms-of-service", SITE_ORIGIN).href,
} satisfies NoticeEmailInput;

/** Renders the notice of a new class announcement for one supported locale. */
function NoticeEmail(input: NoticeEmailInput = noticeEmailPreviewInput) {
  const { classUrl, locale, privacyPolicyUrl, termsOfServiceUrl } = {
    ...noticeEmailPreviewInput,
    ...input,
  };
  return (
    <Layout
      copy={getNoticeEmailCopy(locale)}
      ctaUrl={classUrl}
      locale={locale}
      privacyPolicyUrl={privacyPolicyUrl}
      termsOfServiceUrl={termsOfServiceUrl}
    />
  );
}

/** Renders localized HTML and text of the notice email. */
export const renderNoticeEmail = Effect.fn("email.notice.render")(function* (
  input: NoticeEmailInput
) {
  const props = yield* Schema.decodeEffect(NoticeEmailInputSchema)(input).pipe(
    Effect.mapError(
      () =>
        new NoticeEmailInputError({
          code: "NOTICE_EMAIL_INPUT_INVALID",
          message: "Notice email input is invalid.",
        })
    )
  );
  const copy = getNoticeEmailCopy(props.locale);
  const email = <NoticeEmail {...props} />;
  const renderFailure = () =>
    new NoticeEmailRenderError({
      code: "NOTICE_EMAIL_RENDER_FAILED",
      message: "Unable to render the notice email.",
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
NoticeEmail.PreviewProps = noticeEmailPreviewInput;
export default NoticeEmail;
