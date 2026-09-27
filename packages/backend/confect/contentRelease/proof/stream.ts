"use node";

import { QueryRunner } from "@confect/server";
import { ContentHeadSchema } from "@nakafa/aksara-contracts/release/head";
import refs from "@repo/backend/confect/_generated/refs";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { parseStoredJson } from "@repo/backend/confect/contentRelease/parse";
import type {
  CatalogCursor,
  CatalogPage,
} from "@repo/backend/confect/contentRelease/proof/catalog";
import { contractFailure } from "@repo/backend/confect/contentRelease/proof/failure";
import type {
  ProofPage,
  RouteProofPage,
} from "@repo/backend/confect/contentRelease/proof/read";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { Effect, Option, Schema, Stream } from "effect";
/** Replays one complete bounded proof stream across indexed query pages. */
export function readProofStream(ctx: ActionCtx, releaseId: string) {
  return Stream.paginate(-1, (afterIndex) =>
    QueryRunner.QueryRunner.pipe(
      Effect.flatMap((runQuery) =>
        runQuery(refs.internal.contentRelease.proof.read.page, {
          afterIndex,
          releaseId,
        })
      ),
      Effect.provide(QueryRunner.layer(ctx.runQuery)),
      Effect.catchTag("SchemaError", Effect.die),
      Effect.map(
        (page): readonly [ProofPage["rows"], Option.Option<number>] => [
          page.rows,
          page.done ? Option.none() : Option.some(page.nextIndex),
        ]
      )
    )
  );
}

/** Replays the complete effective catalog in canonical indexed order. */
export function readResultStream(ctx: ActionCtx, releaseId: string) {
  return Stream.paginate(null, (cursor: CatalogCursor | null) =>
    QueryRunner.QueryRunner.pipe(
      Effect.flatMap((runQuery) =>
        runQuery(refs.internal.contentRelease.proof.catalog.page, {
          cursor,
          releaseId,
        })
      ),
      Effect.provide(QueryRunner.layer(ctx.runQuery)),
      Effect.catchTag("SchemaError", Effect.die),
      Effect.flatMap((page) =>
        Effect.gen(function* () {
          if (
            !page.done &&
            (page.nextCursor === null ||
              (page.nextCursor.contentKey === cursor?.contentKey &&
                page.nextCursor.artifactLocale === cursor.artifactLocale))
          ) {
            return yield* releaseFail(
              "CONTENT_RELEASE_INTEGRITY",
              "Result catalog proof stopped advancing."
            );
          }
          const heads = yield* Schema.decodeEffect(
            Schema.Array(ContentHeadSchema)
          )(page.heads).pipe(Effect.mapError(contractFailure));
          return [
            heads,
            page.done ? Option.none() : Option.fromNullishOr(page.nextCursor),
          ] satisfies readonly [
            CatalogPage["heads"],
            Option.Option<CatalogCursor>,
          ];
        })
      )
    )
  );
}

/** Replays one complete canonical signed route stream. */
export function readRouteStream(ctx: ActionCtx, releaseId: string) {
  return Stream.paginate(-1, (afterIndex) =>
    QueryRunner.QueryRunner.pipe(
      Effect.flatMap((runQuery) =>
        runQuery(refs.internal.contentRelease.proof.read.routePage, {
          afterIndex,
          releaseId,
        })
      ),
      Effect.provide(QueryRunner.layer(ctx.runQuery)),
      Effect.catchTag("SchemaError", Effect.die),
      Effect.map(
        (page): readonly [RouteProofPage["rows"], Option.Option<number>] => [
          page.rows,
          page.done ? Option.none() : Option.some(page.nextIndex),
        ]
      )
    )
  ).pipe(Stream.mapEffect(({ routeJson }) => parseStoredJson(routeJson)));
}
