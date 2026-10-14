import {
  type ActiveAppLocaleCode,
  ActiveAppLocaleCodeSchema,
} from "@nakafa/aksara-contracts/locale";
import { legalLabels } from "@repo/email/legal";
import { EmailUrlSchema } from "@repo/email/url";
import { Schema } from "effect";

export const AccountReadyEmailInputSchema = Schema.Struct({
  continueUrl: EmailUrlSchema,
  locale: ActiveAppLocaleCodeSchema,
  privacyPolicyUrl: EmailUrlSchema,
  termsOfServiceUrl: EmailUrlSchema,
});
export type AccountReadyEmailInput = typeof AccountReadyEmailInputSchema.Type;
const AccountReadyEmailCopySchema = Schema.Struct({
  body: Schema.String,
  cta: Schema.String,
  footerReason: Schema.String,
  subject: Schema.String,
});
type AccountReadyEmailCopy = typeof AccountReadyEmailCopySchema.Type;
const accountReadyEmailCopy = {
  de: {
    body: "Dein Konto ist eingerichtet. Wähle ein Fach oder starte einen Probetest, wenn du bereit bist.",
    cta: "Weiterlernen",
    footerReason:
      "Wir senden dir diese E-Mail, weil du ein Nakafa-Konto erstellt hast.",
    subject: "Dein Nakafa-Konto ist bereit",
  },
  en: {
    body: "Your account is set up. Explore a subject or start a Tryout whenever you're ready.",
    cta: "Continue learning",
    footerReason: "We sent this email because you created a Nakafa account.",
    subject: "Your Nakafa account is ready",
  },
  id: {
    body: "Akunmu sudah siap. Pilih mata pelajaran atau mulai try out kapan pun kamu siap.",
    cta: "Lanjut belajar",
    footerReason: "Kami mengirim email ini karena kamu membuat akun Nakafa.",
    subject: "Akun Nakafa kamu sudah siap",
  },
} satisfies Record<ActiveAppLocaleCode, AccountReadyEmailCopy>;

/** Returns the reviewed product copy for one active app locale. */
export function getAccountReadyEmailCopy(locale: ActiveAppLocaleCode) {
  return { ...accountReadyEmailCopy[locale], ...legalLabels[locale] };
}
