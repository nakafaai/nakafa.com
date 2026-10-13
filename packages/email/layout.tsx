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
                href={ctaUrl}
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
                  className="mr-4 text-muted-foreground underline"
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
