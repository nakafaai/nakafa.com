import {
  type ActiveAppLocaleCode,
  ActiveAppLocaleCodeSchema,
} from "@nakafa/aksara-contracts/locale";
import { legalLabels } from "@repo/email/legal";
import { EmailUrlSchema } from "@repo/email/url";
import { isSingleLine } from "@repo/utilities/line";
import { Schema } from "effect";

/** The two wordings a reminder is tried in, so the one that brings more learners back can be kept. */
export const ReminderVariant = Schema.Literals(["a", "b"]);

/**
 * What a try-out reminder says: the set the learner started, the whole hours left before it ends, the page that
 * resumes it, the wording it is tried in, and the links every email carries. It names no person and no answer
 * (ADR 0027).
 */
export const ReminderEmailInputSchema = Schema.Struct({
  continueUrl: EmailUrlSchema,
  hoursLeft: Schema.Int.check(Schema.isBetween({ maximum: 24, minimum: 1 })),
  locale: ActiveAppLocaleCodeSchema,
  privacyPolicyUrl: EmailUrlSchema,
  setTitle: Schema.String.check(
    Schema.isTrimmed(),
    isSingleLine,
    Schema.isMinLength(1),
    Schema.isMaxLength(120)
  ),
  termsOfServiceUrl: EmailUrlSchema,
  unsubscribeUrl: EmailUrlSchema,
  variant: ReminderVariant,
});
export type ReminderEmailInput = typeof ReminderEmailInputSchema.Type;

const ReminderEmailCopySchema = Schema.Struct({
  body: Schema.String,
  cta: Schema.String,
  footerReason: Schema.String,
  subject: Schema.String,
});

/** The words a reminder needs to be written: the set, the hours left, and the wording. */
type ReminderWords = Pick<
  ReminderEmailInput,
  "hoursLeft" | "setTitle" | "variant"
>;

/** "1 hour" or "6 hours", as each language counts them. */
const hoursIn = {
  de: (hours: number) => (hours === 1 ? "1 Stunde" : `${hours} Stunden`),
  en: (hours: number) => (hours === 1 ? "1 hour" : `${hours} hours`),
  id: (hours: number) => `${hours} jam`,
} satisfies Record<ActiveAppLocaleCode, (hours: number) => string>;

const reminderEmailCopy = {
  de: ({ hoursLeft, setTitle, variant }) => ({
    body:
      variant === "a"
        ? `Dein Probetest ${setTitle} läuft noch ${hoursIn.de(hoursLeft)}. Mach dort weiter, wo du aufgehört hast.`
        : `Nina hält deinen Platz in ${setTitle} frei. Noch ${hoursIn.de(hoursLeft)}, dann wird gewertet, was du beantwortet hast.`,
    cta: "Weitermachen",
    footerReason:
      "Wir senden dir diese E-Mail, weil du diesen Probetest auf Nakafa begonnen hast.",
    subject:
      variant === "a"
        ? `Noch ${hoursIn.de(hoursLeft)} für ${setTitle}`
        : `Dein Platz in ${setTitle} wartet`,
  }),
  en: ({ hoursLeft, setTitle, variant }) => ({
    body:
      variant === "a"
        ? `Your try-out ${setTitle} stays open for ${hoursIn.en(hoursLeft)}. Pick up where you left off.`
        : `Nina is keeping your seat in ${setTitle}. In ${hoursIn.en(hoursLeft)}, what you answered is scored.`,
    cta: "Continue",
    footerReason:
      "We sent this email because you started this try-out on Nakafa.",
    subject:
      variant === "a"
        ? `${hoursIn.en(hoursLeft)} left for ${setTitle}`
        : `Your seat in ${setTitle} is waiting`,
  }),
  id: ({ hoursLeft, setTitle, variant }) => ({
    body:
      variant === "a"
        ? `Try out ${setTitle} kamu masih terbuka ${hoursIn.id(hoursLeft)} lagi. Lanjutkan dari soal terakhirmu.`
        : `Nina menjaga tempatmu di ${setTitle}. Dalam ${hoursIn.id(hoursLeft)}, jawaban yang ada akan dinilai.`,
    cta: "Lanjutkan",
    footerReason:
      "Kami mengirim email ini karena kamu memulai try out ini di Nakafa.",
    subject:
      variant === "a"
        ? `${hoursIn.id(hoursLeft)} lagi untuk ${setTitle}`
        : `Tempatmu di ${setTitle} menunggu`,
  }),
} satisfies Record<
  ActiveAppLocaleCode,
  (words: ReminderWords) => typeof ReminderEmailCopySchema.Type
>;

/** Returns the reviewed copy of a try-out reminder for one active app locale. */
export function getReminderEmailCopy(
  locale: ActiveAppLocaleCode,
  words: ReminderWords
) {
  return { ...reminderEmailCopy[locale](words), ...legalLabels[locale] };
}
