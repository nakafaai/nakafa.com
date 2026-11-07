import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { EMAIL_LOGO_URL, EMAIL_SENDER } from "@repo/email/brand";
import { Tailwind } from "@repo/email/tailwind";
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

/**
 * The one layout of every Nakafa email, light and dark: the header with the
 * mark, the body with the subject as its heading, one message, and one
 * button, and the footer with the reason the reader got it, the sender, its
 * address, the contact address, and the two legal links. The body is also the
 * preview line.
 */
export function Layout({
  copy,
  ctaUrl,
  locale,
  privacyPolicyUrl,
  termsOfServiceUrl,
}: {
  copy: {
    body: string;
    cta: string;
    footerReason: string;
    privacyPolicy: string;
    subject: string;
    termsOfService: string;
  };
  ctaUrl: string;
  locale: ActiveAppLocaleCode;
  privacyPolicyUrl: string;
  termsOfServiceUrl: string;
}) {
  return (
    <Html dir="ltr" lang={locale}>
      <Tailwind>
        <Head>
          <title>{copy.subject}</title>
          <meta content="light dark" name="color-scheme" />
          <meta content="light dark" name="supported-color-schemes" />
        </Head>
        <Body className="m-0 p-0 font-sans antialiased" dir="ltr" lang={locale}>
          <Preview dir="ltr" lang={locale} useTitleTag={false}>
            {copy.body}
          </Preview>
          <Container
            className="bg-background text-foreground dark:bg-background-dark dark:text-foreground-dark mx-auto max-w-md px-6 py-8"
            dir="ltr"
            lang={locale}
          >
            <Section className="text-center">
              <Img
                alt="Nakafa"
                className="border-border dark:border-border-dark mx-auto rounded-md border border-solid"
                height="40"
                src={EMAIL_LOGO_URL}
                width="40"
              />
            </Section>

            <Section className="mt-6 text-center">
              <Heading
                as="h1"
                className="text-foreground dark:text-foreground-dark m-0 text-2xl leading-8 font-semibold tracking-tight"
              >
                {copy.subject}
              </Heading>
              <Text className="text-foreground dark:text-foreground-dark m-0 mt-3 text-base leading-6">
                {copy.body}
              </Text>
            </Section>

            <Section className="mt-6 text-center">
              <Button
                className="bg-primary text-primary-foreground dark:bg-primary-dark dark:text-primary-foreground-dark box-border inline-block rounded-md px-8 py-3 text-center text-sm font-medium whitespace-nowrap no-underline outline-none"
                href={ctaUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                {copy.cta}
              </Button>
            </Section>

            <Hr className="border-border dark:border-border-dark my-8 w-full border-0 border-t border-solid" />

            <Section className="text-center">
              <Text className="text-muted-foreground dark:text-muted-foreground-dark m-0 text-xs leading-5">
                {copy.footerReason}
              </Text>
              <Text className="text-muted-foreground dark:text-muted-foreground-dark m-0 mt-3 text-xs leading-5">
                {EMAIL_SENDER.name}
              </Text>
              <Text className="text-muted-foreground dark:text-muted-foreground-dark m-0 mt-1 text-xs leading-5">
                {EMAIL_SENDER.address}
              </Text>
              <Text className="m-0 mt-1 text-xs leading-5">
                <Link
                  className="text-muted-foreground dark:text-muted-foreground-dark underline"
                  href={`mailto:${EMAIL_SENDER.contact}`}
                >
                  {EMAIL_SENDER.contact}
                </Link>
              </Text>
              <Text className="m-0 mt-3 text-xs leading-5">
                <Link
                  className="text-muted-foreground dark:text-muted-foreground-dark mr-4 underline"
                  href={privacyPolicyUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {copy.privacyPolicy}
                </Link>{" "}
                <Link
                  className="text-muted-foreground dark:text-muted-foreground-dark underline"
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
