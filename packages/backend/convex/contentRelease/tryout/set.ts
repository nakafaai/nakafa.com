import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import type {
  TryoutSection,
  TryoutSet,
} from "@nakafa/aksara-contracts/tryout/spec";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadTryoutCatalog } from "@repo/backend/convex/contentRelease/tryout/catalog";
import { readTryoutSection } from "@repo/backend/convex/contentRelease/tryout/section";
import { Effect } from "effect";

/** Stable authored keys that select one localized signed try-out set. */
export type TryoutSetIdentity = Pick<
  TryoutSet,
  "countryKey" | "examKey" | "locale" | "setKey" | "trackKey"
>;

/** Loads one complete verified set snapshot for immutable attempt creation. */
export const readTryoutSet = Effect.fn("contentRelease.readTryoutSet")(
  function* (ctx: QueryCtx, identity: TryoutSetIdentity) {
    const catalog = yield* loadTryoutCatalog(ctx, identity.locale);
    if (!(catalog.managed && catalog.snapshotId)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_MISSING",
        "The active try-out snapshot is unavailable."
      );
    }

    const setIdentity = tryoutCatalogIdentity({ ...identity, kind: "set" });
    const set = catalog.entries
      .flatMap((entry) =>
        entry.row.kind === "set"
          ? [{ row: entry.row, rowHash: entry.rowHash }]
          : []
      )
      .find(({ row }) => tryoutCatalogIdentity(row) === setIdentity);
    if (!set) {
      return yield* releaseFail(
        "CONTENT_RELEASE_MISSING",
        `Try-out set ${setIdentity} is unavailable.`
      );
    }

    const sectionRecords = catalog.entries
      .flatMap((entry) =>
        entry.row.kind === "section"
          ? [{ row: entry.row, rowHash: entry.rowHash }]
          : []
      )
      .filter(({ row }) => matchesSet(row, set.row))
      .sort((left, right) => left.row.order - right.row.order);
    const questionCount = sectionRecords.reduce(
      (total, { row }) => total + row.questionCount,
      0
    );
    if (
      sectionRecords.length !== set.row.sectionCount ||
      questionCount !== set.row.questionCount
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Try-out set ${setIdentity} lost one or more signed sections.`
      );
    }

    const sections = yield* Effect.forEach(sectionRecords, ({ row }) =>
      readTryoutSection(ctx, row)
    );
    const entrySectionKey = set.row.internalEntrySectionKey;
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

    return { sections, set, setIdentity, snapshotId: catalog.snapshotId };
  }
);

/** Complete authenticated set state frozen into one new attempt. */
export type VerifiedTryoutSet = Effect.Effect.Success<
  ReturnType<typeof readTryoutSet>
>;

/** Checks whether one signed section belongs to one exact signed set. */
function matchesSet(section: TryoutSection, set: TryoutSet) {
  return (
    section.countryKey === set.countryKey &&
    section.examKey === set.examKey &&
    section.locale === set.locale &&
    section.trackKey === set.trackKey &&
    section.setKey === set.setKey
  );
}
