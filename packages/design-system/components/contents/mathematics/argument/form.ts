import { Array as Arr, Match, Option, Schema } from "effect";

/**
 * What one card says, in the shapes the textbook's three forms are built
 * from: "All A are B" (`all`), "C is A" (`member`), "If p, then q"
 * (`conditional`), and "p is true" or "Not q is true" (`claim`). The letters
 * are the lesson's own names for the sets and the statements, never shown to
 * the learner: two cards that speak of one set or one statement use one name.
 */
const StatementSchema = Schema.Union([
  Schema.TaggedStruct("all", {
    predicate: Schema.String,
    subject: Schema.String,
  }),
  Schema.TaggedStruct("member", { member: Schema.String, set: Schema.String }),
  Schema.TaggedStruct("conditional", {
    antecedent: Schema.String,
    consequent: Schema.String,
  }),
  Schema.TaggedStruct("claim", {
    negated: Schema.Boolean,
    statement: Schema.String,
  }),
]);
export type Statement = typeof StatementSchema.Type;

/** One card: the words the learner reads, what they say, and whether that is true. */
const ArgumentCardSchema = Schema.Struct({
  statement: StatementSchema,
  text: Schema.String,
  truth: Schema.Boolean,
});
export type ArgumentCard = typeof ArgumentCardSchema.Type;

/** The textbook's three valid forms. */
const FormSchema = Schema.Literals(["I", "II", "III"]);
export type Form = typeof FormSchema.Type;

/**
 * The invalid look-alikes a chain can be built on: affirming the consequent
 * ("if p then q; q; so p"), denying the antecedent ("if p then q; not p; so
 * not q"), and the undistributed middle ("all A are B; c is B; so c is A").
 */
const FallacySchema = Schema.Literals([
  "consequent",
  "antecedent",
  "middle",
]);
export type Fallacy = typeof FallacySchema.Type;

/**
 * What a full chain is: one of the valid forms; a fallacy; premises that
 * never meet, so the chain breaks between them; or premises that meet but
 * do not lead to this conclusion, so it breaks before the conclusion.
 */
const VerdictSchema = Schema.Union([
  Schema.TaggedStruct("valid", { form: FormSchema }),
  Schema.TaggedStruct("fallacy", { fallacy: FallacySchema }),
  Schema.TaggedStruct("unlinked", {}),
  Schema.TaggedStruct("unfollowed", {}),
]);
type Verdict = typeof VerdictSchema.Type;

/** How one link of the chain stands: waiting for its cards, locked, or broken. */
const JointSchema = Schema.Literals(["pending", "locked", "broken"]);
export type Joint = typeof JointSchema.Type;

const sameStatement = Schema.toEquivalence(StatementSchema);

const member = (name: string, set: string): Statement => ({
  _tag: "member",
  member: name,
  set,
});

const claim = (statement: string, negated: boolean): Statement => ({
  _tag: "claim",
  negated,
  statement,
});

const valid = (form: Form): Verdict => ({ _tag: "valid", form });

const fallacy = (kind: Fallacy): Verdict => ({
  _tag: "fallacy",
  fallacy: kind,
});

/**
 * Every step a general premise allows from a particular one: the case the
 * step needs, the conclusion it reaches, and what the chain then is. "All A
 * are B" with "c is A" reaches "c is B" (form I). "If p, then q" with "p" reaches
 * "q" (form II), and with "not q" reaches "not p" (form III). The other steps
 * run the rule backwards, which is each fallacy.
 */
function stepsOf(rule: Statement, fact: Statement) {
  return Match.value({ fact, rule }).pipe(
    Match.when(
      { fact: { _tag: "member" }, rule: { _tag: "all" } },
      ({ fact: { member: name }, rule: { predicate, subject } }) => [
        {
          case: member(name, subject),
          conclusion: member(name, predicate),
          verdict: valid("I"),
        },
        {
          case: member(name, predicate),
          conclusion: member(name, subject),
          verdict: fallacy("middle"),
        },
      ]
    ),
    Match.when(
      { fact: { _tag: "claim" }, rule: { _tag: "conditional" } },
      ({ rule: { antecedent, consequent } }) => [
        {
          case: claim(antecedent, false),
          conclusion: claim(consequent, false),
          verdict: valid("II"),
        },
        {
          case: claim(consequent, true),
          conclusion: claim(antecedent, true),
          verdict: valid("III"),
        },
        {
          case: claim(consequent, false),
          conclusion: claim(antecedent, false),
          verdict: fallacy("consequent"),
        },
        {
          case: claim(antecedent, true),
          conclusion: claim(consequent, true),
          verdict: fallacy("antecedent"),
        },
      ]
    ),
    Match.orElse(() => [])
  );
}

/**
 * The step two premises take together, whichever slot holds the general one:
 * none when neither speaks of what the other does.
 */
function stepOf(first: Statement, second: Statement) {
  return Arr.findFirst(
    [
      [first, second],
      [second, first],
    ] as const,
    ([rule, fact]) =>
      Arr.findFirst(stepsOf(rule, fact), (step) =>
        sameStatement(step.case, fact)
      )
  );
}

/** Judges a full chain: its two premises and its conclusion. */
export function judge(
  first: Statement,
  second: Statement,
  conclusion: Statement
): Verdict {
  return Option.match(stepOf(first, second), {
    onNone: (): Verdict => ({ _tag: "unlinked" }),
    onSome: (step): Verdict =>
      sameStatement(step.conclusion, conclusion)
        ? step.verdict
        : { _tag: "unfollowed" },
  });
}

/**
 * Reads the chain as its slots stand, the first premise, the second and the
 * conclusion, each filled or still empty. The link between the premises
 * locks once both are in and speak of one thing, and breaks if they do not;
 * the link to the conclusion locks once a full chain is valid and breaks if
 * it is not, unless the chain already broke above it. The lamp lights for a
 * valid chain. The premises are true when every one is, and the chain is
 * sound when it is valid and they are.
 */
export function readChain(
  slots: readonly [
    Option.Option<ArgumentCard>,
    Option.Option<ArgumentCard>,
    Option.Option<ArgumentCard>,
  ]
) {
  const [first, second, conclusion] = slots;
  const premises = Option.all([first, second]);
  const verdict = Option.map(
    Option.all([first, second, conclusion]),
    ([one, two, end]) => judge(one.statement, two.statement, end.statement)
  );
  const premisesTrue = Option.map(premises, ([one, two]) =>
    Arr.every([one, two], (card) => card.truth)
  );
  const upper: Joint = Option.match(premises, {
    onNone: () => "pending",
    onSome: ([one, two]) =>
      Option.isSome(stepOf(one.statement, two.statement)) ? "locked" : "broken",
  });
  const lower: Joint = Option.match(verdict, {
    onNone: () => "pending",
    onSome: (each) => {
      if (upper === "broken") {
        return "pending";
      }
      return each._tag === "valid" ? "locked" : "broken";
    },
  });
  const isValid = Option.map(verdict, (each) => each._tag === "valid");
  return {
    joints: [upper, lower] as const,
    lit: Option.getOrElse(isValid, () => false),
    premisesTrue,
    sound: Option.map(
      Option.all([isValid, premisesTrue]),
      ([follows, allTrue]) => follows && allTrue
    ),
    valid: isValid,
    verdict,
  };
}
