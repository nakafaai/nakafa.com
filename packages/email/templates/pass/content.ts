import {
  type ActiveAppLocaleCode,
  ActiveAppLocaleCodeSchema,
} from "@nakafa/aksara-contracts/locale";
import { legalLabels } from "@repo/email/legal";
import { EmailUrlSchema } from "@repo/email/url";
import { isSingleLine } from "@repo/utilities/line";
import { Schema } from "effect";

/**
 * What the pass reminder says: the day the learner's Pro pass ends, written in
 * their language, where to buy the next one, and the legal links. The day is
 * named in the subject, so it is one line.
 */
export const PassEndingEmailInputSchema = Schema.Struct({
  endsOn: Schema.String.check(
    Schema.isTrimmed(),
    isSingleLine,
    Schema.isMinLength(1),
    Schema.isMaxLength(60)
  ),
  extendUrl: EmailUrlSchema,
  locale: ActiveAppLocaleCodeSchema,
  privacyPolicyUrl: EmailUrlSchema,
  termsOfServiceUrl: EmailUrlSchema,
});
export type PassEndingEmailInput = typeof PassEndingEmailInputSchema.Type;
const PassEndingEmailCopySchema = Schema.Struct({
  body: Schema.String,
  cta: Schema.String,
  footerReason: Schema.String,
  subject: Schema.String,
});
const passEndingEmailCopy = {
  de: (endsOn) => ({
    body: `Dein Pro-Pass endet am ${endsOn}. Ein weiterer Pass beginnt genau dann, sodass dir kein Tag Pro fehlt.`,
    cta: "Pro verlängern",
    footerReason:
      "Wir senden dir diese E-Mail, weil du einen Nakafa Pro-Pass gekauft hast.",
    subject: `Dein Pro-Pass endet am ${endsOn}`,
  }),
  en: (endsOn) => ({
    body: `Your Pro pass ends on ${endsOn}. Another pass starts right then, so you keep every day of Pro.`,
    cta: "Extend Pro",
    footerReason: "We sent this email because you bought a Nakafa Pro pass.",
    subject: `Your Pro pass ends on ${endsOn}`,
  }),
  id: (endsOn) => ({
    body: `Pass Pro kamu berakhir pada ${endsOn}. Pass berikutnya langsung mulai saat itu, jadi Pro kamu tidak terputus.`,
    cta: "Perpanjang Pro",
    footerReason:
      "Kami mengirim email ini karena kamu membeli pass Nakafa Pro.",
    subject: `Pass Pro kamu berakhir pada ${endsOn}`,
  }),
} satisfies Record<
  ActiveAppLocaleCode,
  (endsOn: string) => typeof PassEndingEmailCopySchema.Type
>;

/** Returns the reviewed reminder copy for one active app locale and the day the pass ends. */
export function getPassEndingEmailCopy(
  locale: ActiveAppLocaleCode,
  endsOn: string
) {
  return { ...passEndingEmailCopy[locale](endsOn), ...legalLabels[locale] };
}
