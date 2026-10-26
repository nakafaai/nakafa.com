/**
 * The keys of the Arabic keypad. The letters come in hijaiyah order, the order a learner recites
 * them, then the hamza and its seats, taa marbuta and alif maqsura. The marks are the harakat a
 * learner writes over a letter, each named by its key in the Common messages.
 */
export const ARABIC_LETTERS = [
  "ا",
  "ب",
  "ت",
  "ث",
  "ج",
  "ح",
  "خ",
  "د",
  "ذ",
  "ر",
  "ز",
  "س",
  "ش",
  "ص",
  "ض",
  "ط",
  "ظ",
  "ع",
  "غ",
  "ف",
  "ق",
  "ك",
  "ل",
  "م",
  "ن",
  "ه",
  "و",
  "ي",
  "ء",
  "أ",
  "إ",
  "آ",
  "ؤ",
  "ئ",
  "ة",
  "ى",
] as const;

/** The harakat, each with the name of its key in the Common messages. */
export const ARABIC_MARKS = [
  { mark: "َ", name: "arabic-fatha" },
  { mark: "ِ", name: "arabic-kasra" },
  { mark: "ُ", name: "arabic-damma" },
  { mark: "ْ", name: "arabic-sukun" },
  { mark: "ّ", name: "arabic-shadda" },
  { mark: "ً", name: "arabic-fathatan" },
  { mark: "ٍ", name: "arabic-kasratan" },
  { mark: "ٌ", name: "arabic-dammatan" },
] as const;

/** The Arabic comma, question mark and semicolon. */
export const ARABIC_PUNCTUATION = ["،", "؟", "؛"] as const;
