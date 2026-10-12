import { Record as Rec, Schema } from "effect";

/**
 * One question Nina asks about a learner's words, as data. `type` is the kind
 * of question the decision model answers, `instructions` is what it reads, and
 * `threshold` is the probability from which its answer counts as yes. A
 * decision model reads the words of any language, so the instructions say what
 * the text is about and never name a language, a word or a pattern.
 */
const Judgment = Schema.Struct({
  instructions: Schema.NonEmptyString,
  threshold: Schema.Finite.check(Schema.isBetween({ maximum: 1, minimum: 0 })),
  type: Schema.Literal("boolean"),
});

/**
 * Every judgment, by name. Adding a judgment is adding an entry here.
 *
 * `lasting` is asked about a whole message. `ownNote` and `private` are asked
 * about a note, the sentence the capture model proposes with the words of the
 * learner it quotes (`judgment/note`, `noteText`). Each text goes to the
 * decision model in a request of its own, the way it was measured.
 *
 * The thresholds were measured on 12 October 2026 on the dev deployment, with
 * the `judgment:measure` command, on a labelled set of 124 messages and 85
 * notes in 17 languages and 8 scripts (ADR 0022 holds the tables). They were
 * chosen on the same set they were measured on, so the numbers describe this
 * set and are not a forecast of how the judgments do on what learners write.
 * Run the command again when the instructions, the model or the set change.
 */
export const judgments = {
  // Whether the capture model runs for a message.
  lasting: {
    instructions:
      "The learner states something about themselves that will still matter in later study sessions: their grade or level, a goal, how they like to learn, something they find hard, or a situation with a date such as an exam.",
    // A memory that is missed is lost, and a message judged yes by mistake
    // costs one capture call that then saves nothing. At 0.5 none of the 56
    // messages labelled yes is missed.
    threshold: 0.5,
    type: "boolean",
  },
  // Whether a saved sentence is the learner's own note, kept when it is.
  ownNote: {
    instructions:
      "The note is a fact the learner could jot down for themself, in the language of the quote, short as notes are. It does not talk about the learner from the outside, as a third person would.",
    // At 0.6, 53 of the 54 own notes are kept and 28 of the 31 notes that are
    // not the learner's own are dropped. At 0.5, 12 of those 31 are kept.
    threshold: 0.6,
    type: "boolean",
  },
  // Whether a saved sentence and its quote hold something private, dropped when they do.
  private: {
    instructions:
      "The text contains contact details, a home address, an identity or account number, a password, or information about health, religion, ethnicity, political views or money.",
    // Every one of the 30 private notes is at 0.8 or more and every other note
    // is below 0.5, so 0.5 separates the set without a mistake, and so does
    // 0.65. The lower of the two is kept, because keeping a private note is the
    // worse mistake.
    threshold: 0.5,
    type: "boolean",
  },
} satisfies Record<string, typeof Judgment.Type>;

/** The name of a judgment, as a schema for the contracts that name one. */
export const JudgmentName = Schema.Literals(Rec.keys(judgments));
export type JudgmentName = typeof JudgmentName.Type;
