import {
  type AppLocaleCode,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import {
  type TryoutSet,
  TryoutSetSchema,
} from "@nakafa/aksara-contracts/tryout/catalog";
import { tryoutCatalogNodeIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import { loadTryoutOwner } from "@repo/backend/content/tryout/owner";
import { readTryoutSectionRows } from "@repo/backend/content/tryout/section";
import { TryoutSource } from "@repo/backend/content/tryout/source";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { TRYOUT_SET_QUESTION_LIMIT } from "@repo/backend/convex/contentRelease/tryout/limits";
import { verifyTryoutCatalog } from "@repo/backend/convex/contentRelease/tryout/verify";
import { Effect, Option, Schema } from "effect";
/** Stable authored keys that select one localized signed try-out set. */
export interface TryoutSetIdentity {
  readonly countryKey: TryoutSet["countryKey"];
  readonly examKey: TryoutSet["examKey"];
  readonly locale: AppLocaleCode;
  readonly setKey: TryoutSet["setKey"];
  readonly trackKey: TryoutSet["trackKey"];
}
/** Loads one complete verified set snapshot for immutable attempt creation. */
export const readTryoutSet = Effect.fn("contentRelease.readTryoutSet")(
  function* (identity: TryoutSetIdentity) {
    const owner = yield* loadTryoutOwner();
    const { snapshotId } = owner;
    const setIdentity = tryoutCatalogNodeIdentity({
      appLocale: AppLocaleSchema.make(identity.locale),
      countryKey: identity.countryKey,
      examKey: identity.examKey,
      kind: "set",
      setKey: identity.setKey,
      trackKey: identity.trackKey,
    });
    const source = yield* TryoutSource;
    const storedSet = Option.getOrNull(
      yield* source.identity(snapshotId, setIdentity)
    );
    if (!storedSet) {
      return yield* releaseFail(
        "CONTENT_RELEASE_MISSING",
        `Try-out set ${setIdentity} is unavailable.`
      );
    }
    const catalogRow = yield* verifyTryoutCatalog(storedSet, snapshotId);
    const setRow = yield* Schema.decodeUnknownEffect(TryoutSetSchema)(
      catalogRow
    ).pipe(Effect.orDie);
    if (setRow.questionCount > TRYOUT_SET_QUESTION_LIMIT) {
      return yield* releaseFail(
        "CONTENT_RELEASE_LIMIT",
        `Try-out set ${setIdentity} exceeds ${TRYOUT_SET_QUESTION_LIMIT} placements.`
      );
    }
    if (setRow.sectionCount > setRow.questionCount) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Try-out set ${setIdentity} has more sections than questions.`
      );
    }
    const storedSections = yield* source.sections(
      snapshotId,
      setIdentity,
      setRow.sectionCount + 1
    );
    if (storedSections.length !== setRow.sectionCount) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Try-out set ${setIdentity} lost one or more signed sections.`
      );
    }
    const sections = yield* Effect.forEach(storedSections, (storedSection) =>
      readTryoutSectionRows(snapshotId, storedSection)
    );
    const questionCount = sections.reduce(
      (total, { section }) => total + section.row.questionCount,
      0
    );
    const hasChangedOrder = sections.some(
      ({ section }, index) => section.row.order !== index + 1
    );
    if (hasChangedOrder || questionCount !== setRow.questionCount) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Try-out set ${setIdentity} lost one or more signed sections.`
      );
    }
    const set = { row: setRow, rowHash: storedSet.rowHash };
    const entrySectionKey = setRow.internalEntrySectionKey;
    if (
      entrySectionKey &&
      !sections.some(
        ({ section }) =>
          section.row.sectionKey === entrySectionKey &&
          section.row.visibility === "internal-entry"
      )
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Try-out set ${setIdentity} lost its internal entry section.`
      );
    }
    return { sections, set, setIdentity, snapshotId };
  }
);
/** Complete authenticated set state frozen into one new attempt. */
export type VerifiedTryoutSet = Effect.Success<
  ReturnType<typeof readTryoutSet>
>;
