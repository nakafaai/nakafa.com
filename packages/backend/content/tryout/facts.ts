import type { CatalogRow } from "@nakafa/aksara-contracts/assessment/catalog";
import type { Paper } from "@nakafa/aksara-contracts/assessment/paper";
import type { ExamProfile } from "@nakafa/aksara-contracts/assessment/profile";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { tryoutSetIdentityOf } from "@repo/backend/confect/tryouts/route";
import { readPaper, readProfile } from "@repo/backend/confect/tryouts/rows";
import { tryoutScoringStrategyValidator } from "@repo/backend/confect/tryouts/score";
import { Array as Arr, Effect, HashMap, Option, Schema, Tuple } from "effect";

type CatalogSet = Extract<CatalogRow, { kind: "set" }>;

/**
 * What a set's catalog rows leave to its paper and profile: its question count, the kind of score it
 * reports, and each section's question count and time limit, in the profile's order.
 */
export const SetFacts = Schema.Struct({
  questionCount: Schema.Finite,
  scoringStrategy: tryoutScoringStrategyValidator,
  sections: Schema.Array(
    Schema.Struct({
      questionCount: Schema.Finite,
      sectionKey: Schema.String,
      timeLimitSeconds: Schema.Finite,
    })
  ),
});
export type SetFacts = typeof SetFacts.Type;

/**
 * Derives one set's facts from its paper and the profile the paper follows. A profile section the
 * paper does not place is a broken snapshot.
 */
const factsOf = Effect.fn("tryout.facts.factsOf")(function* (
  paper: Paper,
  profile: ExamProfile
) {
  const sections = yield* Effect.forEach(profile.sections, (template) =>
    Option.match(
      Arr.findFirst(paper.sections, ({ section }) => section === template.id),
      {
        onNone: () =>
          releaseFail(
            "CONTENT_RELEASE_INTEGRITY",
            `Paper ${paper.id} places no section ${template.id} of its profile.`
          ),
        onSome: ({ placements }) =>
          Effect.succeed({
            questionCount: placements.length,
            sectionKey: template.id,
            timeLimitSeconds: template.seconds,
          }),
      }
    )
  );
  return {
    questionCount: Arr.reduce(
      sections,
      0,
      (total, { questionCount }) => total + questionCount
    ),
    scoringStrategy: profile.scoring.kind,
    sections,
  } satisfies SetFacts;
});

/**
 * Reads the facts of each set from its paper and the profile the paper follows, reading each
 * profile once, by the set's locale-free identity.
 */
export const readSetFacts = Effect.fn("tryout.facts.readSetFacts")(function* (
  snapshotId: string,
  sets: readonly CatalogSet[]
) {
  const papers = yield* Effect.forEach(sets, (set) =>
    Effect.map(readPaper(snapshotId, set.paper), ({ paper }) => ({
      paper,
      set,
    }))
  );
  const references: readonly Paper["profile"][] = Arr.map(
    papers,
    ({ paper }) => paper.profile
  );
  const profiles = HashMap.fromIterable(
    yield* Effect.forEach(
      Arr.dedupeWith(
        references,
        (left, right) => left.id === right.id && left.hash === right.hash
      ),
      (reference) =>
        Effect.map(readProfile(snapshotId, reference), ({ profile }) =>
          Tuple.make(reference.id, profile)
        )
    )
  );
  return HashMap.fromIterable(
    yield* Effect.forEach(papers, ({ paper, set }) =>
      Effect.fromOption(HashMap.get(profiles, paper.profile.id)).pipe(
        // Every profile id above was read into the map.
        Effect.orDie,
        Effect.flatMap((profile) => factsOf(paper, profile)),
        Effect.map((facts) => Tuple.make(tryoutSetIdentityOf(set), facts))
      )
    )
  );
});
