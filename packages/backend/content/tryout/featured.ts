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
import { Array as Arr, Effect, Option, Schema } from "effect";

/** The authored question the landing page demonstrates: the first place of one SNBT section. */
export const LANDING_FEATURED_TRYOUT = {
  countryKey: "indonesia",
  examKey: "snbt",
  sectionKey: "quantitative-knowledge",
  setKey: "set-1",
  trackKey: "2027",
} as const;

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
    const target = LANDING_FEATURED_TRYOUT;
    const { snapshotId } = yield* loadActiveAssessment();
    const found = yield* readCatalogSet(
      snapshotId,
      tryoutSetIdentityOf(target),
      locale
    );
    if (Option.isNone(found)) {
      return yield* missingFeatured("set");
    }
    const { sections, set } = found.value;
    if (
      !Arr.some(
        sections,
        ({ sectionKey, visibility }) =>
          sectionKey === target.sectionKey && visibility === "visible"
      )
    ) {
      return yield* missingFeatured("section");
    }
    const { paper } = yield* readPaper(snapshotId, set.paper);
    const place = Option.flatMap(
      Arr.findFirst(
        paper.sections,
        ({ section }) => section === target.sectionKey
      ),
      ({ placements }) => Arr.head(placements)
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
