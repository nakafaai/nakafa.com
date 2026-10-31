import type { CatalogRow } from "@nakafa/aksara-contracts/assessment/catalog";
import { ItemVersionSchema } from "@nakafa/aksara-contracts/assessment/item";
import { ItemKeySchema } from "@nakafa/aksara-contracts/assessment/key";
import type { Paper } from "@nakafa/aksara-contracts/assessment/paper";
import type { ExamProfile } from "@nakafa/aksara-contracts/assessment/profile";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { encodePlacedQuestion } from "@repo/backend/confect/tryouts/runtime/question";
import type { TryoutSection } from "@repo/backend/confect/tryouts/runtime/schema";
import { Array as Arr, Effect, HashMap, Option, Schema, Tuple } from "effect";

type CatalogSection = Extract<CatalogRow, { kind: "section" }>;

/** The fields of one placement an attempt freezes, before the attempt that owns it exists. */
export type FrozenPlacement = Omit<
  Docs["tryoutAttemptPlacements"],
  "_creationTime" | "_id" | "clearedVersion" | "tryoutAttemptId"
>;

/**
 * A snapshot cannot be frozen into an attempt: a section of the profile has no section in the paper
 * or the catalog, a place names an item version the snapshot does not hold, a version holds other than
 * one interaction, its key has no answer for it, or no rule scores it. Ingress proves a snapshot's
 * closure, so each is a snapshot the player cannot run, never a learner's mistake.
 */
class TryoutFreezeError extends Schema.TaggedError<TryoutFreezeError>()(
  "TryoutFreezeError",
  {
    code: Schema.Literals([
      "TRYOUT_SECTION_UNPLACED",
      "TRYOUT_ITEM_MISSING",
      "TRYOUT_ITEM_SHAPE",
      "TRYOUT_KEY_MISSING",
      "TRYOUT_RULE_MISSING",
    ]),
    message: Schema.String,
  }
) {}

/** One item version of the paper with its key, as the snapshot holds them by the version's hash. */
export const PlacedItem = Schema.Struct({
  key: ItemKeySchema,
  version: ItemVersionSchema,
});
export type PlacedItem = typeof PlacedItem.Type;

/**
 * Freezes one place: the version's one interaction, the key's answer for it, and its rule, the
 * version's override for the interaction, else the profile's default for its kind. The player and the
 * grader read one interaction per question, as School's do.
 */
const freezePlace = Effect.fn("tryouts.start.freezePlace")(function* (
  profile: ExamProfile,
  item: PlacedItem,
  place: { readonly questionOrder: number; readonly sectionKey: string }
) {
  const { key, version } = item;
  if (version.interactions.length !== 1) {
    return yield* new TryoutFreezeError({
      code: "TRYOUT_ITEM_SHAPE",
      message: `Item version ${version.hash} holds ${version.interactions.length} interactions; a try-out question holds one.`,
    });
  }
  const interaction = Arr.headNonEmpty(version.interactions);
  const answer = Arr.findFirst(
    key.answers,
    (candidate) => candidate.interaction === interaction.id
  );
  if (Option.isNone(answer)) {
    return yield* new TryoutFreezeError({
      code: "TRYOUT_KEY_MISSING",
      message: `The key of item version ${version.hash} has no answer for ${interaction.id}.`,
    });
  }
  const rule = Option.orElse(
    Option.map(
      Arr.findFirst(
        version.scoring,
        (override) => override.interaction === interaction.id
      ),
      ({ rule }) => rule
    ),
    () =>
      Option.map(
        Arr.findFirst(
          profile.defaults,
          (fallback) => fallback.interaction === interaction.kind
        ),
        ({ rule }) => rule
      )
  );
  if (Option.isNone(rule)) {
    return yield* new TryoutFreezeError({
      code: "TRYOUT_RULE_MISSING",
      message: `No rule scores the ${interaction.kind} of item version ${version.hash}.`,
    });
  }
  return {
    ...(yield* encodePlacedQuestion({ interaction, key: answer.value })),
    deliveryLanguage: version.deliveryLanguage,
    family: version.family,
    questionOrder: place.questionOrder,
    rule: rule.value,
    sectionKey: place.sectionKey,
    versionHash: version.hash,
  } satisfies FrozenPlacement;
});

/**
 * Freezes a set into the sections and places of one attempt. The sections follow the profile's
 * order; each takes its order and public path from its catalog row, its question count from the
 * paper's places, and its time limit from the profile's template. Each section numbers its questions
 * from 1 in the paper's order, as an exam numbers each of its sections.
 */
export const freezeAttempt = Effect.fn("tryouts.start.freezeAttempt")(
  function* (source: {
    readonly items: readonly PlacedItem[];
    readonly paper: Paper;
    readonly profile: ExamProfile;
    readonly sections: readonly CatalogSection[];
  }) {
    const items = HashMap.fromIterable(
      Arr.map(source.items, (item) => Tuple.make(item.version.hash, item))
    );
    const frozen = yield* Effect.forEach(source.profile.sections, (template) =>
      Effect.gen(function* () {
        const paperSection = Arr.findFirst(
          source.paper.sections,
          ({ section }) => section === template.id
        );
        const catalogSection = Arr.findFirst(
          source.sections,
          ({ sectionKey }) => sectionKey === template.id
        );
        if (Option.isNone(paperSection) || Option.isNone(catalogSection)) {
          return yield* new TryoutFreezeError({
            code: "TRYOUT_SECTION_UNPLACED",
            message: `Section ${template.id} of profile ${source.profile.id} has no section in the paper or the catalog.`,
          });
        }
        const placements = yield* Effect.forEach(
          paperSection.value.placements,
          (place, index) =>
            Effect.gen(function* () {
              const item = HashMap.get(items, place.hash);
              if (Option.isNone(item)) {
                return yield* new TryoutFreezeError({
                  code: "TRYOUT_ITEM_MISSING",
                  message: `The snapshot holds no item version ${place.hash} for the paper ${source.paper.id}.`,
                });
              }
              return yield* freezePlace(source.profile, item.value, {
                questionOrder: index + 1,
                sectionKey: template.id,
              });
            })
        );
        const section: TryoutSection = {
          ...(catalogSection.value.publicPath === undefined
            ? {}
            : { publicPath: catalogSection.value.publicPath }),
          questionCount: paperSection.value.placements.length,
          sectionKey: template.id,
          sectionOrder: catalogSection.value.order,
          timeLimitSeconds: template.seconds,
        };
        return { placements, section };
      })
    );
    return {
      placements: Arr.flatMap(frozen, ({ placements }) => placements),
      sections: Arr.map(frozen, ({ section }) => section),
    };
  }
);
