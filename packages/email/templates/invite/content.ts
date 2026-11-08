import {
  ActiveAppLocaleCodeSchema,
  type AppLocaleCode,
} from "@nakafa/aksara-contracts/locale";
import { legalLabels } from "@repo/email/legal";
import { EmailUrlSchema } from "@repo/email/url";
import { isSingleLine } from "@repo/utilities/line";
import { Schema } from "effect";

/**
 * What the invitation email says: who invited, where to sign in, and the legal
 * links. The organisation is named in the subject, so it is one line: a line
 * break in it would end the header.
 */
export const InviteEmailInputSchema = Schema.Struct({
  locale: ActiveAppLocaleCodeSchema,
  organisation: Schema.String.check(
    Schema.isTrimmed(),
    isSingleLine,
    Schema.isMinLength(1),
    Schema.isMaxLength(120)
  ),
  privacyPolicyUrl: EmailUrlSchema,
  signInUrl: EmailUrlSchema,
  termsOfServiceUrl: EmailUrlSchema,
});
export type InviteEmailInput = typeof InviteEmailInputSchema.Type;
const InviteEmailCopySchema = Schema.Struct({
  body: Schema.String,
  cta: Schema.String,
  footerReason: Schema.String,
  subject: Schema.String,
});
const inviteEmailCopy = {
  de: (organisation) => ({
    body: "Melde dich mit dieser E-Mail-Adresse an, um beizutreten.",
    cta: "Anmelden",
    footerReason: `Wir senden dir diese E-Mail, weil ${organisation} diese Adresse zu Nakafa eingeladen hat.`,
    subject: `${organisation} hat dich zu Nakafa eingeladen`,
  }),
  en: (organisation) => ({
    body: "Sign in with this email address to join.",
    cta: "Sign in",
    footerReason: `We sent this email because ${organisation} invited this address to Nakafa.`,
    subject: `${organisation} invited you to Nakafa`,
  }),
  id: (organisation) => ({
    body: "Masuk dengan alamat email ini untuk bergabung.",
    cta: "Masuk",
    footerReason: `Kami mengirim email ini karena ${organisation} mengundang alamat ini ke Nakafa.`,
    subject: `${organisation} mengundang kamu ke Nakafa`,
  }),
  ms: (organisation) => ({
    body: "Log masuk dengan alamat e-mel ini untuk menyertai.",
    cta: "Log masuk",
    footerReason: `Kami menghantar e-mel ini kerana ${organisation} telah menjemput alamat ini ke Nakafa.`,
    subject: `${organisation} menjemput kamu ke Nakafa`,
  }),
} satisfies Record<
  AppLocaleCode,
  (organisation: string) => typeof InviteEmailCopySchema.Type
>;

/** Returns the reviewed product copy for one app locale and the inviting organisation. */
export function getInviteEmailCopy(
  locale: AppLocaleCode,
  organisation: string
) {
  return { ...inviteEmailCopy[locale](organisation), ...legalLabels[locale] };
}
