import { ACTIVE_APP_LOCALES } from "@nakafa/aksara-contracts/locale";
import {
  QuranAttributionRowSchema,
  quranSourceIds,
} from "@nakafa/aksara-contracts/quran/source";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadQuranOwner } from "@repo/backend/convex/contentRelease/quran/owner";
import { readQuranRow } from "@repo/backend/convex/contentRelease/quran/row";
import { Effect } from "effect";

const ATTRIBUTION_IDENTITY = `attribution:${quranSourceIds(ACTIVE_APP_LOCALES).join(":")}`;

/** Returns the visible signed source attribution for active Quran content. */
export const readQuranAttribution = Effect.fn(
  "contentRelease.readQuranAttribution"
)(function* (ctx: QueryCtx) {
  const owner = yield* loadQuranOwner(ctx);
  if (owner.snapshotId === null) {
    return {
      ...owner,
      rowJson: null,
    };
  }
  const row = yield* readQuranRow(
    ctx,
    owner.snapshotId,
    ATTRIBUTION_IDENTITY,
    QuranAttributionRowSchema
  );
  return {
    ...owner,
    rowJson: row.rowJson,
  };
});
