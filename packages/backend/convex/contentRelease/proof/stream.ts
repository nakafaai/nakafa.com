"use node";

import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import { parseStoredJson } from "@repo/backend/convex/contentRelease/parse";
import type {
  CatalogCursor,
  CatalogPage,
} from "@repo/backend/convex/contentRelease/proof/catalog";
import type {
  ProofPage,
  RouteProofPage,
} from "@repo/backend/convex/contentRelease/proof/read";
import { makeFunctionReference } from "convex/server";
import { Effect, Option, Stream } from "effect";

const proofPageReference = makeFunctionReference<
  "query",
  { afterIndex: number; releaseId: string },
  ProofPage
>("contentRelease/proof/read:page");
const catalogPageReference = makeFunctionReference<
  "query",
  { cursor: CatalogCursor | null; releaseId: string },
  CatalogPage
>("contentRelease/proof/catalog:page");
const routePageReference = makeFunctionReference<
  "query",
  { afterIndex: number; releaseId: string },
  RouteProofPage
>("contentRelease/proof/read:routePage");

/** Replays one complete bounded proof stream across indexed query pages. */
export function readProofStream(ctx: ActionCtx, releaseId: string) {
  return Stream.paginate(-1, (afterIndex) =>
    callInternal(() =>
      ctx.runQuery(proofPageReference, { afterIndex, releaseId })
    ).pipe(
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
    callInternal(() =>
      ctx.runQuery(catalogPageReference, { cursor, releaseId })
    ).pipe(
      Effect.map(
        (
          page
        ): readonly [CatalogPage["heads"], Option.Option<CatalogCursor>] => [
          page.heads,
          page.done || page.nextCursor === null
            ? Option.none()
            : Option.some(page.nextCursor),
        ]
      )
    )
  );
}

/** Replays one complete canonical signed route stream. */
export function readRouteStream(ctx: ActionCtx, releaseId: string) {
  return Stream.paginate(-1, (afterIndex) =>
    callInternal(() =>
      ctx.runQuery(routePageReference, { afterIndex, releaseId })
    ).pipe(
      Effect.map(
        (page): readonly [RouteProofPage["rows"], Option.Option<number>] => [
          page.rows,
          page.done ? Option.none() : Option.some(page.nextIndex),
        ]
      )
    )
  ).pipe(Stream.mapEffect(({ routeJson }) => parseStoredJson(routeJson)));
}
