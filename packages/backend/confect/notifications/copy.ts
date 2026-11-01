import type { AppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import type { NotificationsDoc } from "@repo/backend/confect/_generated/docs";

/** The language of a notice with no school: an account keeps none, and Nakafa's learners are Indonesian. */
export const ACCOUNT_LOCALE: typeof AppLocaleCodeSchema.Type = "id";

/**
 * The general sentences a push shows on a lock screen, in each language a school
 * unit teaches in. They name no one and quote nothing (ADR 0027): the inbox,
 * opened behind the push, shows the rest to its reader.
 */
const SENTENCES = {
  de: {
    "announcement.posted": "In deiner Klasse gibt es eine neue Ankündigung.",
    "assignment.published": "In deiner Klasse gibt es eine neue Aufgabe.",
    "assignment.deadline": "Die Frist einer Aufgabe endet bald.",
    "assignment.missed":
      "Dein Kind hat eine Aufgabe nicht rechtzeitig abgegeben.",
    "forum.mentioned": "Jemand hat dich in deiner Klasse erwähnt.",
    "person.invited": "Du wurdest an eine Schule eingeladen.",
    "exam.starting": "Deine Prüfung beginnt bald.",
    "exam.reminder": "Eine Prüfung deines Kindes steht bevor.",
    "grade.released": "Eine neue Note wurde freigegeben.",
    "comment.replied": "Jemand hat auf deinen Kommentar geantwortet.",
  },
  en: {
    "announcement.posted": "There is a new announcement in your class.",
    "assignment.published": "There is a new task in your class.",
    "assignment.deadline": "A task's deadline is coming up.",
    "assignment.missed": "Your child did not hand in a task on time.",
    "forum.mentioned": "Someone mentioned you in your class.",
    "person.invited": "You have been invited to a school.",
    "exam.starting": "Your exam starts soon.",
    "exam.reminder": "Your child has an exam coming up.",
    "grade.released": "A new grade has been released.",
    "comment.replied": "Someone replied to your comment.",
  },
  id: {
    "announcement.posted": "Ada pengumuman baru di kelasmu.",
    "assignment.published": "Ada tugas baru di kelasmu.",
    "assignment.deadline": "Tenggat sebuah tugas sudah dekat.",
    "assignment.missed": "Anakmu belum mengumpulkan tugas tepat waktu.",
    "forum.mentioned": "Seseorang menyebutmu di kelas.",
    "person.invited": "Kamu diundang ke sebuah sekolah.",
    "exam.starting": "Ujianmu segera dimulai.",
    "exam.reminder": "Anakmu akan mengikuti ujian.",
    "grade.released": "Ada nilai baru yang dirilis.",
    "comment.replied": "Ada yang membalas komentarmu.",
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
