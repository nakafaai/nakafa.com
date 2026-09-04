import {
  type ActiveAppLocaleCode,
  ActiveAppLocaleCodeSchema,
} from "@nakafa/aksara-contracts/locale";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import { Schema } from "effect";

const loopbackHostnames = new Set(["127.0.0.1", "[::1]", "localhost"]);

function isEmailUrl(value: string) {
  if (!URL.canParse(value)) {
    return false;
  }

  const url = new URL(value);
  return (
    url.protocol === "https:" ||
    (url.protocol === "http:" && loopbackHostnames.has(url.hostname))
  );
}

const EmailUrlSchema = Schema.String.check(
  Schema.makeFilter(isEmailUrl, {
    message: "Expected HTTPS or a loopback HTTP URL.",
  })
);

export const AccountReadyEmailInputSchema = Schema.Struct({
  continueUrl: EmailUrlSchema,
  locale: ActiveAppLocaleCodeSchema,
  privacyPolicyUrl: EmailUrlSchema,
  termsOfServiceUrl: EmailUrlSchema,
});

export type AccountReadyEmailInput = Schema.Schema.Type<
  typeof AccountReadyEmailInputSchema
>;

export interface AccountReadyEmailCopy {
  readonly body: string;
  readonly cta: string;
  readonly footerReason: string;
  readonly privacyPolicy: string;
  readonly subject: string;
  readonly termsOfService: string;
}

const accountReadyEmailCopy = {
  de: {
    body: "Dein Konto ist eingerichtet. Wähle ein Fach oder starte einen Probetest, wenn du bereit bist.",
    cta: "Weiterlernen",
    footerReason:
      "Wir senden dir diese E-Mail, weil du ein Nakafa-Konto erstellt hast.",
    privacyPolicy: "Datenschutzerklärung",
    subject: "Dein Nakafa-Konto ist bereit",
    termsOfService: "Nutzungsbedingungen",
  },
  en: {
    body: "Your account is set up. Explore a subject or start a Tryout whenever you're ready.",
    cta: "Continue learning",
    footerReason: "We sent this email because you created a Nakafa account.",
    privacyPolicy: "Privacy Policy",
    subject: "Your Nakafa account is ready",
    termsOfService: "Terms of Service",
  },
  id: {
    body: "Akunmu sudah siap. Pilih mata pelajaran atau mulai try out kapan pun kamu siap.",
    cta: "Lanjut belajar",
    footerReason: "Kami mengirim email ini karena kamu membuat akun Nakafa.",
    privacyPolicy: "Kebijakan Privasi",
    subject: "Akun Nakafa kamu sudah siap",
    termsOfService: "Syarat dan Ketentuan",
  },
} satisfies Record<ActiveAppLocaleCode, AccountReadyEmailCopy>;

const canonicalSiteUrl = new URL(COMPANY_IDENTITY.url);

/** Returns the reviewed product copy for one active app locale. */
export function getAccountReadyEmailCopy(locale: ActiveAppLocaleCode) {
  return accountReadyEmailCopy[locale];
}

/** Resolves a canonical public Nakafa URL for email assets and previews. */
export function getPublicEmailUrl(pathname: string) {
  return new URL(pathname, canonicalSiteUrl).href;
}
