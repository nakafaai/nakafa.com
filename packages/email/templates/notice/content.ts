import {
  type ActiveAppLocaleCode,
  ActiveAppLocaleCodeSchema,
} from "@nakafa/aksara-contracts/locale";
import { legalLabels } from "@repo/email/legal";
import { EmailUrlSchema } from "@repo/email/url";
import { Schema } from "effect";

/**
 * What a notice email says: a class holds a new announcement, and the link that
 * opens it. It names no one and quotes nothing (ADR 0027), so it carries only the
 * class's address and the legal links.
 */
export const NoticeEmailInputSchema = Schema.Struct({
  classUrl: EmailUrlSchema,
  locale: ActiveAppLocaleCodeSchema,
  privacyPolicyUrl: EmailUrlSchema,
  termsOfServiceUrl: EmailUrlSchema,
});
export type NoticeEmailInput = typeof NoticeEmailInputSchema.Type;
const NoticeEmailCopySchema = Schema.Struct({
  body: Schema.String,
  cta: Schema.String,
  footerReason: Schema.String,
  subject: Schema.String,
});
const noticeEmailCopy = {
  de: {
    body: "In deiner Klasse auf Nakafa gibt es eine neue Ankündigung. Öffne die Klasse, um sie zu lesen.",
    cta: "Klasse öffnen",
    footerReason:
      "Wir senden dir diese E-Mail, weil deine Lehrkraft diese Ankündigung auch per E-Mail verschickt hat.",
    subject: "Neue Ankündigung in deiner Klasse",
  },
  en: {
    body: "There is a new announcement in your class on Nakafa. Open the class to read it.",
    cta: "Open the class",
    footerReason:
      "We sent this email because your teacher chose to send this announcement by email too.",
    subject: "New announcement in your class",
  },
  id: {
    body: "Ada pengumuman baru di kelasmu di Nakafa. Buka kelas untuk membacanya.",
    cta: "Buka kelas",
    footerReason:
      "Kami mengirim email ini karena gurumu memilih mengirim pengumuman ini juga lewat email.",
    subject: "Pengumuman baru di kelasmu",
  },
} satisfies Record<ActiveAppLocaleCode, typeof NoticeEmailCopySchema.Type>;

/** Returns the reviewed copy of a notice email for one active app locale. */
export function getNoticeEmailCopy(locale: ActiveAppLocaleCode) {
  return { ...noticeEmailCopy[locale], ...legalLabels[locale] };
}
