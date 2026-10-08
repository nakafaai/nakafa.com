import { boundText, NINA_BUDGET } from "@repo/backend/confect/nina/budget";
import type { NinaLearnerProfile } from "@repo/backend/confect/nina/memory.spec";
import { Array as Arr, pipe } from "effect";

const FOCUS_LABELS = {
  learning: "learning lessons",
  tryout: "preparing for try-outs",
} as const;

/** Formats the account facts Nina reads for a turn, when there are any. */
export function formatLearnerProfile(profile: typeof NinaLearnerProfile.Type) {
  let lines = Arr.filter(
    [
      profile.focus && `- Focus: ${FOCUS_LABELS[profile.focus]}`,
      profile.region && `- Region: ${profile.region}`,
      profile.tryoutCountry &&
        `- Preferred try-out country: ${profile.tryoutCountry}`,
    ],
    (line): line is string => Boolean(line)
  );
  const { tryout } = profile;
  if (tryout) {
    const date = new Date(tryout.finishedAt).toISOString().slice(0, 10);
    lines = Arr.appendAll(lines, [
      `- Latest finished try-out: ${tryout.exam} ${tryout.set} on ${date}, score ${tryout.score} (${tryout.status}), ${tryout.correct} of ${tryout.total} correct`,
      ...Arr.map(
        tryout.sections,
        (section) =>
          `  - ${section.key}: ${section.correct} of ${section.total} correct`
      ),
    ]);
  }
  return lines.length > 0 ? Arr.join(["Account:", ...lines], "\n") : undefined;
}

/**
 * Formats what Nina knows about the learner: account facts and, while memory
 * is on, the facts remembered from earlier conversations, newest first so a
 * bounded prompt keeps the latest corrections. Returns nothing when Nina knows
 * nothing.
 */
export function formatLearnerPrompt({
  facts,
  profile,
}: {
  readonly facts: readonly { readonly text: string }[];
  readonly profile: typeof NinaLearnerProfile.Type;
}) {
  const account = formatLearnerProfile(profile);
  const remembered =
    facts.length > 0
      ? Arr.join(
          [
            "Remembered from earlier conversations, newest first (the learner can view and delete these in settings):",
            ...Arr.map(Arr.reverse(facts), (fact) => `- ${fact.text}`),
          ],
          "\n"
        )
      : undefined;
  if (!(account || remembered)) {
    return;
  }
  return boundText(
    pipe(
      [
        "# Learner",
        "Use these facts to personalize explanations, examples, and study advice when they are relevant. When the learner says something different now, follow the learner.",
        account,
        remembered,
      ],
      Arr.filter((part): part is string => Boolean(part)),
      Arr.join("\n\n")
    ),
    NINA_BUDGET.learner,
    "Learner facts shortened."
  );
}
