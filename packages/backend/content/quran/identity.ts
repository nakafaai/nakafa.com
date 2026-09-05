import { QuranSearchRowSchema } from "@nakafa/aksara-contracts/quran/snapshot/row";
import { QuranSurahNumberSchema } from "@nakafa/aksara-contracts/quran/spec";
import { loadQuranOwner } from "@repo/backend/content/quran/owner";
import { readQuranRow } from "@repo/backend/content/quran/row";
import { authenticateQuranSearchHit } from "@repo/backend/content/quran/search";
import { QuranSource } from "@repo/backend/content/quran/source";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { quranSearchIdentity } from "@repo/backend/convex/contentRelease/quran/facts";
import type { ActiveContentReferenceInput } from "@repo/backend/convex/contentRelease/reference/input";
import { buildContentSearchDocument } from "@repo/backend/convex/contents/helpers/search/documents";
import { Effect, Option, Schema } from "effect";

/** Resolves one Quran route or graph asset through its active signed row. */
export const readQuranReference = Effect.fn(
  "contentRelease.readQuranReference"
)(function* (input: ActiveContentReferenceInput) {
  const owner = yield* loadQuranOwner();
  if (owner.snapshotId === null) {
    return null;
  }
  const signed = yield* readQuranReferenceRow(owner.snapshotId, input);
  if (signed === null) {
    return null;
  }
  return buildContentSearchDocument({
    ...signed.payload.graph,
    contentHash: signed.rowHash,
    hasMarkdownSource: true,
    locale: input.publicLocale,
    route: signed.payload.route,
    section: "quran",
    sourcePath: signed.payload.route,
    syncedAt: signed.index,
    text: signed.payload.text,
    title: signed.payload.title,
  });
});

/** Reads one current Quran search row through its exact semantic index. */
const readQuranReferenceRow = Effect.fn("contentRelease.readQuranReferenceRow")(
  function* (snapshotId: string, input: ActiveContentReferenceInput) {
    if (input.kind === "content") {
      const rows = yield* (yield* QuranSource).search(
        snapshotId,
        input.appLocale,
        input.contentId
      );
      if (rows.length > 1) {
        return yield* identityCollision("Quran");
      }
      const row = rows[0];
      if (!row) {
        return null;
      }
      return yield* authenticateQuranSearchHit(snapshotId, row);
    }
    const segments = input.publicPath.split("/");
    const surahNumber = Schema.decodeOption(QuranSurahNumberSchema)(
      Number(segments[1])
    );
    if (
      segments.length !== 2 ||
      Option.isNone(surahNumber) ||
      input.publicPath !== `quran/${surahNumber.value}`
    ) {
      return null;
    }
    return yield* readQuranRow(
      snapshotId,
      quranSearchIdentity(input.appLocale, surahNumber.value),
      QuranSearchRowSchema
    );
  }
);

/** Rejects a semantic identity shared by multiple current catalog rows. */
function identityCollision(family: string) {
  return releaseFail(
    "CONTENT_RELEASE_INTEGRITY",
    `Current ${family} identity resolves multiple catalog rows.`
  );
}
