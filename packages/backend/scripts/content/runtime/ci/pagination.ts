import {
  contentRuntimeCiError,
  productionRuntimeReadError,
} from "@repo/backend/scripts/content/runtime/ci/error";
import {
  type JsonObject,
  JsonObjectSchema,
} from "@repo/backend/scripts/content/runtime/ci/json";
import { Effect, Schema } from "effect";

export const CONTENT_RUNTIME_TABLE_PAGE_SIZE = 4096;

const ConvexTablePageSchema = Schema.Struct({
  continueCursor: Schema.String,
  isDone: Schema.Boolean,
  page: Schema.Array(JsonObjectSchema),
});

interface ConvexTablePageRequest {
  readonly cursor: null | string;
  readonly numItems: number;
}

type ReadConvexTablePage = (
  request: ConvexTablePageRequest
) => Promise<unknown>;

export const collectConvexTableRows = Effect.fn(
  "contentRuntime.collectProductionTable"
)(function* (options: {
  readonly limit: number;
  readonly readPage: ReadConvexTablePage;
  readonly sensitiveValues?: readonly string[];
  readonly table: string;
}) {
  const rows: JsonObject[] = [];
  const cursors = new Set<string>();
  let cursor: null | string = null;

  while (rows.length < options.limit) {
    const numItems = Math.min(
      CONTENT_RUNTIME_TABLE_PAGE_SIZE,
      options.limit - rows.length
    );
    const rawPage = yield* Effect.tryPromise({
      catch: (cause) =>
        productionRuntimeReadError(
          options.table,
          cause,
          options.sensitiveValues ?? []
        ),
      try: () => options.readPage({ cursor, numItems }),
    });
    const page = yield* Schema.decodeUnknownEffect(ConvexTablePageSchema)(
      rawPage
    ).pipe(
      Effect.mapError(() =>
        contentRuntimeCiError(
          `Production read for ${options.table} returned invalid pagination data.`
        )
      )
    );

    const remaining = options.limit - rows.length;
    rows.push(...page.page.slice(0, remaining));
    if (page.isDone || page.page.length >= remaining) {
      return rows;
    }
    if (
      page.page.length === 0 ||
      page.continueCursor.length === 0 ||
      page.continueCursor === cursor ||
      cursors.has(page.continueCursor)
    ) {
      return yield* contentRuntimeCiError(
        `Production read for ${options.table} returned an invalid pagination cursor.`
      );
    }

    cursors.add(page.continueCursor);
    cursor = page.continueCursor;
  }

  return rows;
});
