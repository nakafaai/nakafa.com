import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { loadActiveAssessment } from "@repo/backend/confect/tryouts/active";
import { readCatalogSet } from "@repo/backend/confect/tryouts/catalog/rows";
import { tryoutSetIdentityOf } from "@repo/backend/confect/tryouts/route";
import {
  readItemKey,
  readItemVersion,
  readPaper,
  readStimulus,
} from "@repo/backend/confect/tryouts/rows";
import { TryoutQuestionBodyText } from "@repo/backend/confect/tryouts/runtime/spec";
import { Array as Arr, Effect, Option, Result, Schema } from "effect";

/**
 * The authored questions the landing page may demonstrate, in order: the first place of one section
 * of a set. Each set serves only the locales it is explained in, so a locale demonstrates the first
 * set it serves: SNBT where it is explained, and SPM Fizik, written in Malay, where it is not.
 */
export const LANDING_FEATURED_TRYOUTS = [
  {
    countryKey: "indonesia",
    examKey: "snbt",
    sectionKey: "quantitative-knowledge",
    setKey: "set-1",
    trackKey: "2027",
  },
  {
    countryKey: "malaysia",
    examKey: "spm",
    sectionKey: "physics",
    setKey: "set-1",
    trackKey: "physics",
  },
] as const;

/** Fails when the active release does not publish the landing's question. */
function missingFeatured(part: string) {
  return releaseFail(
    "CONTENT_RELEASE_INTEGRITY",
    `The active try-out publication has no featured ${part}.`
  );
}

/**
 * Reads the landing's demonstrated question from the active release in one app locale: the prompt
 * and interaction of the first place of its section, the key's answer that the demonstration reveals,
 * and the reading the version was written against.
 */
export const readFeaturedTryout = Effect.fn("tryouts.catalog.readFeatured")(
  function* (locale: AppLocaleCode) {
    const { snapshotId } = yield* loadActiveAssessment();
    const found = yield* Effect.findFirstFilter(
      LANDING_FEATURED_TRYOUTS,
      (target) =>
        Effect.map(
          readCatalogSet(snapshotId, tryoutSetIdentityOf(target), locale),
          (set) =>
            Result.fromOption(
              Option.map(set, (value) => ({ ...value, target })),
              () => target
            )
        )
    );
    if (Option.isNone(found)) {
      return yield* missingFeatured("set");
    }
    const { sections, set, target } = found.value;
    if (
      !Arr.some(sections, ({ sectionKey }) => sectionKey === target.sectionKey)
    ) {
      return yield* missingFeatured("section");
    }
    const { paper } = yield* readPaper(snapshotId, set.paper);
    const place = Option.flatMap(
      Arr.findFirst(
        paper.sections,
        ({ section }) => section === target.sectionKey
      ),
      // The featured question shows its section's first language.
      ({ placements }) =>
        Option.map(Arr.head(placements), ({ versions }) =>
          Arr.headNonEmpty(versions)
        )
    );
    if (Option.isNone(place)) {
      return yield* missingFeatured("question");
    }
    const [version, key] = yield* Effect.all([
      readItemVersion(place.value.hash),
      readItemKey(place.value.hash),
    ]);
    const interaction = Arr.headNonEmpty(version.interactions);
    const answer = Arr.findFirst(
      key.answers,
      (candidate) => candidate.interaction === interaction.id
    );
    if (Option.isNone(answer)) {
      return yield* missingFeatured("answer");
    }
    const stimulus =
      version.stimulus === undefined
        ? Option.none()
        : Option.some((yield* readStimulus(version.stimulus.hash)).document);
    const body = yield* Schema.encodeEffect(TryoutQuestionBodyText)({
      interaction,
      key: answer.value,
      prompt: version.prompt,
      ...(Option.isSome(stimulus) ? { stimulus: stimulus.value } : {}),
    }).pipe(
      // Every part was decoded by the contract, so it encodes.
      Effect.orDie
    );
    return { body, versionHash: version.hash };
  }
);
