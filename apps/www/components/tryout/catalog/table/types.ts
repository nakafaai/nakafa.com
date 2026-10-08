import type { Ref } from "@confect/core";
import type refs from "@repo/backend/confect/_generated/refs";
import {
  listArgsValidator,
  trackSetPageValidator,
} from "@repo/backend/confect/tryouts/sets/spec";
import { Schema } from "effect";

type SetListQuery = typeof refs.public.tryouts.queries.sets.list;
type TrackPageQuery = typeof refs.public.tryouts.queries.catalog.getTrackPage;

/** Number of additional sets requested by each discovery window. */
export const TRYOUT_SET_PAGE_SIZE = 25;

export type TryoutSetListArgs = Ref.Args<SetListQuery>;
export type TryoutSetPage = Ref.Returns<SetListQuery>;
export type TryoutSetRow = TryoutSetPage["page"][number];
export type TryoutTrackPage = NonNullable<Ref.Returns<TrackPageQuery>>;
export type TryoutSetAttemptStatus = NonNullable<TryoutSetRow["attemptStatus"]>;
export type TryoutSetSort = TryoutSetListArgs["sort"];
export type TryoutSetStatusFilter = TryoutSetListArgs["filter"];

const TryoutCatalogBootstrapSchema = Schema.Struct({
  args: listArgsValidator,
  result: trackSetPageValidator,
});
export type TryoutCatalogBootstrap = typeof TryoutCatalogBootstrapSchema.Type;
