import {
  type ActiveAppLocaleCode,
  ActiveAppLocaleCodeSchema,
} from "@nakafa/aksara-contracts/locale";
import { legalLabels } from "@repo/email/legal";
import { EmailUrlSchema } from "@repo/email/url";
import { Array as Arr, Schema, String as Str } from "effect";

/** What the notice mail of a school can tell, as the inbox row it follows. */
export const SchoolChange = Schema.Literals([
  "exam.starting",
  "exam.reminder",
  "grade.released",
  "assignment.missed",
  "assignment.published",
  "forum.mentioned",
]);

/** What a notice mail can tell: a school's notices, and a reply to an account's comment, which no school holds. */
const DigestChange = Schema.Literals([
  ...SchoolChange.literals,
  "comment.replied",
]);

/**
 * What one notice mail says: how many notices of each kind wait, and the link that opens the inbox. It counts and names
 * no one (ADR 0027), so a grade, a name, and a message never reach a mailbox.
 */
export const DigestEmailInputSchema = Schema.Struct({
  counts: Schema.Array(
    Schema.Struct({
      change: DigestChange,
      count: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
    })
  ).check(Schema.isMinLength(1)),
  inboxUrl: EmailUrlSchema,
  locale: ActiveAppLocaleCodeSchema,
  privacyPolicyUrl: EmailUrlSchema,
  termsOfServiceUrl: EmailUrlSchema,
});
export type DigestEmailInput = typeof DigestEmailInputSchema.Type;

/** One notice in words, and several, where `{count}` stands for the number. */
const Sentence = Schema.Struct({ one: Schema.String, several: Schema.String });

const DigestEmailCopySchema = Schema.Struct({
  accountReason: Schema.String,
  cta: Schema.String,
  footerReason: Schema.String,
  sentences: Schema.Record(DigestChange, Sentence),
  subject: Schema.String,
});

const digestEmailCopy = {
  de: {
    accountReason:
      "Wir senden dir diese E-Mail, weil du auf Nakafa kommentiert hast.",
    cta: "Mitteilungen öffnen",
    footerReason:
      "Wir senden dir diese E-Mail, weil du zu einer Schule auf Nakafa gehörst.",
    sentences: {
      "comment.replied": {
        one: "Jemand hat auf deinen Kommentar geantwortet.",
        several: "Es gibt {count} Antworten auf deine Kommentare.",
      },
      "assignment.missed": {
        one: "Dein Kind hat eine Aufgabe nicht rechtzeitig abgegeben.",
        several: "Dein Kind hat {count} Aufgaben nicht rechtzeitig abgegeben.",
      },
      "assignment.published": {
        one: "In deiner Klasse gibt es eine neue Aufgabe.",
        several: "In deinen Klassen gibt es {count} neue Aufgaben.",
      },
      "exam.reminder": {
        one: "Eine Prüfung deines Kindes steht bevor.",
        several: "{count} Prüfungen deines Kindes stehen bevor.",
      },
      "exam.starting": {
        one: "Deine Prüfung beginnt bald.",
        several: "{count} deiner Prüfungen beginnen bald.",
      },
      "forum.mentioned": {
        one: "Jemand hat dich in deiner Klasse erwähnt.",
        several: "Du wurdest {count}-mal in deinen Klassen erwähnt.",
      },
      "grade.released": {
        one: "Eine neue Note wurde freigegeben.",
        several: "{count} neue Noten wurden freigegeben.",
      },
    },
    subject: "Neues aus deiner Schule",
  },
  en: {
    accountReason: "We sent this email because you commented on Nakafa.",
    cta: "Open your inbox",
    footerReason:
      "We sent this email because you belong to a school on Nakafa.",
    sentences: {
      "comment.replied": {
        one: "Someone replied to your comment.",
        several: "There are {count} replies to your comments.",
      },
      "assignment.missed": {
        one: "Your child did not hand in a task on time.",
        several: "Your child did not hand in {count} tasks on time.",
      },
      "assignment.published": {
        one: "There is a new task in your class.",
        several: "There are {count} new tasks in your classes.",
      },
      "exam.reminder": {
        one: "Your child has an exam coming up.",
        several: "Your child has {count} exams coming up.",
      },
      "exam.starting": {
        one: "Your exam starts soon.",
        several: "{count} of your exams start soon.",
      },
      "forum.mentioned": {
        one: "Someone mentioned you in your class.",
        several: "You were mentioned {count} times in your classes.",
      },
      "grade.released": {
        one: "A new grade has been released.",
        several: "{count} new grades have been released.",
      },
    },
    subject: "What is new at your school",
  },
  id: {
    accountReason: "Kami mengirim email ini karena kamu berkomentar di Nakafa.",
    cta: "Buka notifikasi",
    footerReason:
      "Kami mengirim email ini karena kamu terdaftar di sebuah sekolah di Nakafa.",
    sentences: {
      "comment.replied": {
        one: "Ada yang membalas komentarmu.",
        several: "Ada {count} balasan untuk komentarmu.",
      },
      "assignment.missed": {
        one: "Anakmu belum mengumpulkan tugas tepat waktu.",
        several: "Anakmu belum mengumpulkan {count} tugas tepat waktu.",
      },
      "assignment.published": {
        one: "Ada tugas baru di kelasmu.",
        several: "Ada {count} tugas baru di kelasmu.",
      },
      "exam.reminder": {
        one: "Anakmu akan mengikuti ujian.",
        several: "Anakmu akan mengikuti {count} ujian.",
      },
      "exam.starting": {
        one: "Ujianmu segera dimulai.",
        several: "{count} ujianmu segera dimulai.",
      },
      "forum.mentioned": {
        one: "Seseorang menyebutmu di kelas.",
        several: "Kamu disebut {count} kali di kelasmu.",
      },
      "grade.released": {
        one: "Ada nilai baru yang dirilis.",
        several: "Ada {count} nilai baru yang dirilis.",
      },
    },
    subject: "Kabar baru dari sekolahmu",
  },
} satisfies Record<ActiveAppLocaleCode, typeof DigestEmailCopySchema.Type>;

/**
 * Returns the reviewed copy of one notice mail: one sentence for each kind that waits, and the sentence itself as the
 * subject when the mail tells one thing. A mail of replies names the comment as its reason, since its reader may belong
 * to no school.
 */
export function getDigestEmailCopy({
  counts,
  locale,
}: Pick<DigestEmailInput, "counts" | "locale">) {
  const { accountReason, footerReason, sentences, subject, ...copy } =
    digestEmailCopy[locale];
  const lines = Arr.map(counts, ({ change, count }) =>
    count === 1
      ? sentences[change].one
      : Str.replace("{count}", String(count))(sentences[change].several)
  );
  return {
    ...copy,
    ...legalLabels[locale],
    body: Arr.join(lines, " "),
    footerReason: Arr.some(counts, ({ change }) => change === "comment.replied")
      ? accountReason
      : footerReason,
    subject: Arr.matchLeft(lines, {
      onEmpty: () => subject,
      onNonEmpty: (head, tail) => (Arr.isArrayEmpty(tail) ? head : subject),
    }),
  };
}
