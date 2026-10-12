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
 * learner it quotes (`judgment/ask`, `noteText`). The thresholds come from a
 * labelled set of messages and notes in many languages and scripts, measured
 * with the `judgment:measure` command, not from taste (ADR 0022). The starting
 * instructions of `lasting` and `private` were measured on 12 October 2026 on
 * 15 messages in seven languages, and those of `ownNote` have not been
 * measured yet.
 */
export const judgments = {
  // Whether the capture model runs for a message.
  lasting: {
    instructions:
      "The learner states something about themselves that will still matter in later study sessions: their grade or level, a goal, how they like to learn, something they find hard, or a situation with a date such as an exam.",
    threshold: 0.5,
    type: "boolean",
  },
  // Whether a saved sentence is the learner's own note, kept when it is.
  ownNote: {
    instructions:
      "The note is a fact the learner could jot down for themself, in the language of the quote, short as notes are. It does not talk about the learner from the outside, as a third person would.",
    threshold: 0.5,
    type: "boolean",
  },
  // Whether a saved sentence and its quote hold something private, dropped when they do.
  private: {
    instructions:
      "The text contains contact details, a home address, an identity or account number, a password, or information about health, religion, ethnicity, political views or money.",
    threshold: 0.5,
    type: "boolean",
  },
} satisfies Record<string, typeof Judgment.Type>;

/** The name of a judgment, as a schema for the contracts that name one. */
export const JudgmentName = Schema.Literals(Rec.keys(judgments));
export type JudgmentName = typeof JudgmentName.Type;
