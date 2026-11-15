import type { CatalogRow } from "@nakafa/aksara-contracts/assessment/catalog";
import { ItemVersionSchema } from "@nakafa/aksara-contracts/assessment/item";
import {
  type InteractionKey,
  ItemKeySchema,
} from "@nakafa/aksara-contracts/assessment/key";
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

/** The versions of one place in its section's languages, as a paper names them. */
type PaperPlace = Paper["sections"][number]["placements"][number];

/** The key's answer for a text entry: the texts a learner may type. */
type TextAnswer = Extract<InteractionKey, { kind: "textEntry" }>;

/** Whether a key's answer is a text entry's. */
const isTextAnswer = (answer: InteractionKey): answer is TextAnswer =>
  answer.kind === "textEntry";

/**
 * A snapshot cannot be frozen into an attempt: a section of the profile has no section in the paper
 * or the catalog, a place names an item version the snapshot does not hold, a version holds other than
 * one interaction, its key has no answer for it, or no rule scores it. Ingress proves a snapshot's
 * closure, so each is a snapshot the player cannot run, never a learner's mistake.
 */
class TryoutFreezeError extends Schema.TaggedError<
  TryoutFreezeError,
  { readonly brand: unique symbol }
>()("TryoutFreezeError", {
  code: Schema.Literals([
    "TRYOUT_SECTION_UNPLACED",
    "TRYOUT_ITEM_MISSING",
    "TRYOUT_ITEM_SHAPE",
    "TRYOUT_KEY_MISSING",
    "TRYOUT_RULE_MISSING",
  ]),
  message: Schema.String,
}) {}

/** One item version of the paper with its key, as the snapshot holds them by the version's hash, one per language of a place. */
export const PlacedItem = Schema.Struct({
  key: ItemKeySchema,
  version: ItemVersionSchema,
});
export type PlacedItem = typeof PlacedItem.Type;

/**
 * The key's answer for one interaction across every language version of its item. The contract holds
 * the versions of a place to one structure and one key, apart from the texts a learner may type, so the
 * first version's answer serves, with every version's accepted texts for a text entry. A learner who
 * switches language mid-section is then graded the same, whichever language they typed in.
 */
function unionAnswer(
  first: InteractionKey,
  answers: readonly InteractionKey[]
): InteractionKey {
  if (first.kind !== "textEntry") {
    return first;
  }
  const texts = Arr.flatMap(answers, (answer) =>
    isTextAnswer(answer) ? answer.accepted.acceptedAnswers : []
  );
  return {
    ...first,
    accepted: {
      ...first.accepted,
      acceptedAnswers: [
        ...first.accepted.acceptedAnswers,
        ...Arr.filter(
          Arr.dedupe(texts),
          (text) => !Arr.contains(first.accepted.acceptedAnswers, text)
        ),
      ],
    },
  };
}

/** Reads the item version and key of one language of a place, failing when the snapshot holds none. */
const placedItemOf = Effect.fn("tryouts.start.placedItemOf")(function* (
  items: HashMap.HashMap<string, PlacedItem>,
  hash: string,
  paperId: string
) {
  const item = HashMap.get(items, hash);
  if (Option.isNone(item)) {
    return yield* new TryoutFreezeError({
      code: "TRYOUT_ITEM_MISSING",
      message: `The snapshot holds no item version ${hash} for the paper ${paperId}.`,
    });
  }
  return item.value;
});

/**
 * Freezes one place: its family and its version in each language of its section, the structure of its
 * one interaction, the key's answer for it across every version (`unionAnswer`), and its rule, the
 * version's override for the interaction, else the profile's default for its kind. Every version of a
 * place shares the first's structure, scoring, and key, which the contract checks at publication, so
 * the first decides them. The player and the grader read one interaction per question, as School's do.
 */
const freezePlace = Effect.fn("tryouts.start.freezePlace")(function* (
  profile: ExamProfile,
  items: readonly [PlacedItem, ...PlacedItem[]],
  place: {
    readonly questionOrder: number;
    readonly sectionKey: string;
    readonly versions: PaperPlace["versions"];
  }
) {
  const { key, version } = Arr.headNonEmpty(items);
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
  const answers = Arr.flatMap(items, (item) =>
    Arr.filter(
      item.key.answers,
      (candidate) => candidate.interaction === interaction.id
    )
  );
  return {
    ...(yield* encodePlacedQuestion({
      interaction,
      key: unionAnswer(answer.value, answers),
    })),
    family: version.family,
    questionOrder: place.questionOrder,
    rule: rule.value,
    sectionKey: place.sectionKey,
    versions: place.versions,
  } satisfies FrozenPlacement;
});

/**
 * Freezes a set into the sections and places of one attempt. The sections follow the profile's
 * order; each takes its order and public path from its catalog row, its question count and languages
 * from the paper, and its time limit from the profile's template. Each section numbers its questions
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
              const [first, ...rest] = place.versions;
              const head = yield* placedItemOf(
                items,
                first.hash,
                source.paper.id
              );
              const tail = yield* Effect.forEach(rest, ({ hash }) =>
                placedItemOf(items, hash, source.paper.id)
              );
              return yield* freezePlace(source.profile, [head, ...tail], {
                questionOrder: index + 1,
                sectionKey: template.id,
                versions: place.versions,
              });
            })
        );
        const section: TryoutSection = {
          ...(catalogSection.value.publicPath === undefined
            ? {}
            : { publicPath: catalogSection.value.publicPath }),
          languages: [...paperSection.value.languages],
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
