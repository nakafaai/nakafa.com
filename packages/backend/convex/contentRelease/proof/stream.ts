"use node";

import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import { parseStoredJson } from "@repo/backend/convex/contentRelease/parse";
import type { CatalogPage } from "@repo/backend/convex/contentRelease/proof/catalog";
import type {
  ProofPage,
  RouteProofPage,
} from "@repo/backend/convex/contentRelease/proof/read";
import { makeFunctionReference } from "convex/server";
import { Effect, Option, Stream } from "effect";

const proofPageReference = makeFunctionReference<
  "query",
  { afterIndex: number; kind: "artifact" | "item"; releaseId: string },
  ProofPage
>("contentRelease/proof/read:page");
const catalogPageReference = makeFunctionReference<
  "query",
  { cursor: null | string; releaseId: string },
  CatalogPage
>("contentRelease/proof/catalog:page");
const routePageReference = makeFunctionReference<
  "query",
  { afterIndex: number; releaseId: string },
  RouteProofPage
>("contentRelease/proof/read:routePage");

/** Replays one complete bounded proof stream across indexed query pages. */
export function readProofStream(
  ctx: ActionCtx,
  kind: "artifact" | "item",
  releaseId: string
) {
  return Stream.paginateEffect(-1, (afterIndex) =>
    callInternal(() =>
      ctx.runQuery(proofPageReference, { afterIndex, kind, releaseId })
    ).pipe(
      Effect.map((page): readonly [ProofPage, Option.Option<number>] => [
        page,
        page.done ? Option.none() : Option.some(page.nextIndex),
      ])
    )
  ).pipe(Stream.flatMap(({ rows }) => Stream.fromIterable(rows)));
}

/** Replays the complete effective catalog in canonical indexed order. */
export function readResultStream(ctx: ActionCtx, releaseId: string) {
  return Stream.paginateEffect(null, (cursor: null | string) =>
    callInternal(() =>
      ctx.runQuery(catalogPageReference, { cursor, releaseId })
    ).pipe(
      Effect.map((page): readonly [CatalogPage, Option.Option<string>] => [
        page,
        page.done || page.nextCursor === null
          ? Option.none()
          : Option.some(page.nextCursor),
      ])
    )
  ).pipe(Stream.flatMap(({ heads }) => Stream.fromIterable(heads)));
}

/** Replays one complete canonical signed route stream. */
export function readRouteStream(ctx: ActionCtx, releaseId: string) {
  return Stream.paginateEffect(-1, (afterIndex) =>
    callInternal(() =>
      ctx.runQuery(routePageReference, { afterIndex, releaseId })
    ).pipe(
      Effect.map((page): readonly [RouteProofPage, Option.Option<number>] => [
        page,
        page.done ? Option.none() : Option.some(page.nextIndex),
      ])
    )
  ).pipe(
    Stream.flatMap(({ rows }) => Stream.fromIterable(rows)),
    Stream.mapEffect(({ routeJson }) => parseStoredJson(routeJson))
  );
}
