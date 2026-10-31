import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { Tailwind } from "@repo/email/tailwind";
import {
  COMPANY_IDENTITY,
  COMPANY_REGISTERED_ADDRESS,
} from "@repo/seo/company";
import { SITE_ORIGIN } from "@repo/seo/origin";
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

const EMAIL_LOGO_URL = new URL("/logo.png", SITE_ORIGIN).href;

/**
 * The house layout of a Nakafa email: the logo, one message with one button,
 * and the footer with the sender and the two legal links. The subject is also
 * the heading, and the body is also the preview line.
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
        </Head>
        <Body
          className="bg-background text-foreground m-0 p-0 font-sans antialiased"
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
                className="text-foreground m-0 text-2xl leading-8 font-semibold tracking-tight"
              >
                {copy.subject}
              </Heading>
              <Text className="text-foreground m-0 mt-3 text-base leading-6">
                {copy.body}
              </Text>
            </Section>

            <Section className="mt-6 text-center">
              <Button
                className="bg-primary text-primary-foreground box-border inline-block rounded-md px-8 py-3 text-center text-sm font-medium whitespace-nowrap no-underline outline-none"
                href={ctaUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                {copy.cta}
              </Button>
            </Section>

            <Hr className="border-border my-8 w-full border-0 border-t border-solid" />

            <Section className="text-center">
              <Text className="text-muted-foreground m-0 text-xs leading-5">
                {copy.footerReason}
              </Text>
              <Text className="text-muted-foreground m-0 mt-3 text-xs leading-5">
                {COMPANY_IDENTITY.legalName}
              </Text>
              <Text className="text-muted-foreground m-0 mt-1 text-xs leading-5">
                {COMPANY_REGISTERED_ADDRESS}
              </Text>
              <Text className="text-muted-foreground m-0 mt-3 text-xs leading-5">
                <Link
                  className="text-muted-foreground mr-4 underline"
                  href={privacyPolicyUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {copy.privacyPolicy}
                </Link>{" "}
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
