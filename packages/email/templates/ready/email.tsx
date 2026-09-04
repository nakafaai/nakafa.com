import { render } from "@react-email/render";
import { Tailwind } from "@repo/email/tailwind";
import {
  type AccountReadyEmailInput,
  AccountReadyEmailInputSchema,
  getAccountReadyEmailCopy,
  getPublicEmailUrl,
} from "@repo/email/templates/ready/content";
import {
  COMPANY_IDENTITY,
  COMPANY_REGISTERED_ADDRESS,
} from "@repo/seo/company";
import { Effect, Schema } from "effect";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "react-email";

export type { AccountReadyEmailInput } from "@repo/email/templates/ready/content";

/** Expected invalid input at the account-ready email boundary. */
export class AccountReadyEmailInputError extends Schema.TaggedError<AccountReadyEmailInputError>()(
  "AccountReadyEmailInputError",
  {
    code: Schema.Literal("ACCOUNT_READY_EMAIL_INPUT_INVALID"),
    message: Schema.String,
  }
) {}

/** Expected failure while rendering an account-ready email. */
export class AccountReadyEmailRenderError extends Schema.TaggedError<AccountReadyEmailRenderError>()(
  "AccountReadyEmailRenderError",
  {
    code: Schema.Literal("ACCOUNT_READY_EMAIL_RENDER_FAILED"),
    message: Schema.String,
  }
) {}

const EMAIL_LOGO_URL = getPublicEmailUrl("/logo.png");

/** Renders the privacy-safe account-ready message for one supported locale. */
export function AccountReadyEmail({
  continueUrl,
  locale,
  privacyPolicyUrl,
  termsOfServiceUrl,
}: AccountReadyEmailInput) {
  const copy = getAccountReadyEmailCopy(locale);

  return (
    <Html dir="ltr" lang={locale}>
      <Tailwind>
        <Head>
          <title>{copy.subject}</title>
        </Head>
        <Body
          className="m-0 bg-background p-0 font-sans text-foreground antialiased"
          dir="ltr"
          lang={locale}
        >
          <Preview dir="ltr" lang={locale} useTitleTag={false}>
            {copy.body}
          </Preview>
          <Container
            className="mx-auto max-w-md px-6 py-8"
            dir="ltr"
            lang={locale}
          >
            <Section className="text-center">
              <Img
                alt="Nakafa"
                className="mx-auto"
                height="48"
                src={EMAIL_LOGO_URL}
                width="48"
              />
            </Section>

            <Section className="mt-6 text-center">
              <Heading
                as="h1"
                className="m-0 font-semibold text-2xl text-foreground leading-8 tracking-tight"
              >
                {copy.subject}
              </Heading>
              <Text className="m-0 mt-3 text-base text-foreground leading-6">
                {copy.body}
              </Text>
            </Section>

            <Section className="mt-6 text-center">
              <Button
                className="box-border inline-block whitespace-nowrap rounded-md bg-primary px-8 py-3 text-center font-medium text-primary-foreground text-sm no-underline outline-none"
                href={continueUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                {copy.cta}
              </Button>
            </Section>

            <Hr className="my-8 w-full border-0 border-border border-t border-solid" />

            <Section className="text-center">
              <Text className="m-0 text-muted-foreground text-xs leading-5">
                {copy.footerReason}
              </Text>
              <Text className="m-0 mt-3 text-muted-foreground text-xs leading-5">
                {COMPANY_IDENTITY.legalName}
              </Text>
              <Text className="m-0 mt-1 text-muted-foreground text-xs leading-5">
                {COMPANY_REGISTERED_ADDRESS}
              </Text>
              <Text className="m-0 mt-3 text-muted-foreground text-xs leading-5">
                <Link
                  className="text-muted-foreground underline"
                  href={privacyPolicyUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {copy.privacyPolicy}
                </Link>
                {" · "}
                <Link
                  className="text-muted-foreground underline"
                  href={termsOfServiceUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {copy.termsOfService}
                </Link>
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
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
          try: () => render(email, { plainText: true }),
        }),
      ],
      { concurrency: "unbounded" }
    );

    return { html, subject: copy.subject, text };
  }
);

AccountReadyEmail.PreviewProps = {
  continueUrl: getPublicEmailUrl("/en/home"),
  locale: "en",
  privacyPolicyUrl: getPublicEmailUrl("/en/privacy-policy"),
  termsOfServiceUrl: getPublicEmailUrl("/en/terms-of-service"),
} satisfies AccountReadyEmailInput;

export default AccountReadyEmail;
