import { internal } from "@repo/backend/convex/_generated/api";
import { contentCountTables } from "@repo/backend/convex/contentSync/tables";
import {
  ContentCountsSchema,
  CountTablePageSchema,
} from "@repo/backend/scripts/sync-content/contract/schemas";
import type { ConvexConfig } from "@repo/backend/scripts/sync-content/contract/types";
import { callConvexQuery } from "@repo/backend/scripts/sync-content/convex/client";
import { Effect, Schema } from "effect";

const COUNT_PAGE_SIZE = 1000;

type ContentCountField = (typeof contentCountTables)[number]["field"];

/** Counts every document in one Convex table through bounded paginated reads. */
const countTableDocuments = Effect.fn("sync.countTableDocuments")(function* (
  config: ConvexConfig,
  tableName: (typeof contentCountTables)[number]["tableName"]
) {
  let count = 0;
  let continueCursor: string | null = null;
  let isDone = false;
  let pageSize = 0;

  while (!isDone) {
    ({ continueCursor, isDone, pageSize } = yield* callConvexQuery(
      config,
      internal.contentSync.queries.counts.countTablePage,
      {
        tableName,
        paginationOpts: {
          cursor: continueCursor,
          numItems: COUNT_PAGE_SIZE,
        },
      },
      CountTablePageSchema
    ));

    count += pageSize;
  }

  return count;
});

/** Loads the current row counts for every sync-managed content/runtime table. */
export const getContentCounts = Effect.fn("sync.getContentCounts")(function* (
  config: ConvexConfig
) {
  const entries: [ContentCountField, number][] = [];

  for (const spec of contentCountTables) {
    entries.push([
      spec.field,
      yield* countTableDocuments(config, spec.tableName),
    ]);
  }

  return Schema.decodeUnknownSync(ContentCountsSchema)(
    Object.fromEntries(entries)
  );
});
