import { Array as Arr, String as Str } from "effect";

/**
 * Words that name the learner from the outside instead of saying the fact, by
 * language. The Memory page shows a memory in the learner's own words, so
 * "Learner lebih suka contoh soal" and "Siswa kelas 12" read like a file about
 * someone else.
 */
const LABELS = [
  // Indonesian
  "siswa",
  "murid",
  "pelajar",
  "pembelajar",
  "pengguna",
  // English
  "learner",
  "student",
  "pupil",
  "user",
  // German
  "lernende",
  "lernender",
  "lernenden",
  "lernendem",
  "schüler",
  "schülerin",
  "nutzer",
  "nutzerin",
  "benutzer",
  "benutzerin",
  "studentin",
];

/**
 * The English labels. A model drops one into an Indonesian or German sentence,
 * so one that the learner did not say is the model's word, not the learner's.
 */
const ENGLISH = ["learner", "student", "pupil", "user"];

/** A letter, a digit or an underscore next to a word means it is part of a longer one. */
const BEFORE = String.raw`(?<![\p{L}\p{N}_])`;
const AFTER = String.raw`(?![\p{L}\p{N}_])`;

/** A label at the start of a text, with the article that may lead it: "The learner", "Der Lernende". */
const STARTS = new RegExp(
  String.raw`^(?:(?:the|der|die|das|ein|eine)\s+)?(?:${Arr.join(LABELS, "|")})${AFTER}`,
  "iu"
);

/** Each English label as a whole word. */
const ENGLISH_WORDS = Arr.map(
  ENGLISH,
  (word) => new RegExp(`${BEFORE}${word}${AFTER}`, "iu")
);

/**
 * Whether a memory's text labels the learner: it starts with a word that names
 * them, such as Learner, Siswa, Pengguna, The learner or Der Lernende, or it
 * holds an English label that the learner's own words (`said`) do not. A memory
 * says the fact and leaves the learner out: "Kelas 12 IPA.", not "Siswa kelas
 * 12 IPA.".
 */
export function labelsLearner(text: string, said: string) {
  return (
    STARTS.test(Str.trim(text)) ||
    Arr.some(ENGLISH_WORDS, (word) => word.test(text) && !word.test(said))
  );
}
