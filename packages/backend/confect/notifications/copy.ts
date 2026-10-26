import type { AppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import type { NotificationsDoc } from "@repo/backend/confect/_generated/docs";

/**
 * The general sentences a push shows on a lock screen, in each language a school
 * unit teaches in. They name no one and quote nothing (ADR 0027): the inbox,
 * opened behind the push, shows the rest to its reader.
 */
const SENTENCES = {
  de: {
    "announcement.posted": "In deiner Klasse gibt es eine neue Ankündigung.",
    "forum.mentioned": "Jemand hat dich in deiner Klasse erwähnt.",
    "person.invited": "Du wurdest an eine Schule eingeladen.",
  },
  en: {
    "announcement.posted": "There is a new announcement in your class.",
    "forum.mentioned": "Someone mentioned you in your class.",
    "person.invited": "You have been invited to a school.",
  },
  id: {
    "announcement.posted": "Ada pengumuman baru di kelasmu.",
    "forum.mentioned": "Seseorang menyebutmu di kelas.",
    "person.invited": "Kamu diundang ke sebuah sekolah.",
  },
} satisfies Record<
  typeof AppLocaleCodeSchema.Type,
  Record<NotificationsDoc["changeType"], string>
>;

/** The general sentence of one inbox row's push, in the language `locale`. */
export const pushSentence = (
  changeType: NotificationsDoc["changeType"],
  locale: typeof AppLocaleCodeSchema.Type
) => SENTENCES[locale][changeType];
