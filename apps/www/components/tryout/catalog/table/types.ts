import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionArgs, FunctionReturnType } from "convex/server";

type SetListQuery = typeof api.tryouts.queries.sets.list;
type TrackPageQuery = typeof api.tryouts.queries.catalog.getTrackPage;

/** Number of additional sets requested by each discovery window. */
export const TRYOUT_SET_PAGE_SIZE = 25;

export type TryoutSetListArgs = FunctionArgs<SetListQuery>;
export type TryoutSetPage = FunctionReturnType<SetListQuery>;
export type TryoutSetRow = TryoutSetPage["page"][number];
export type TryoutTrackPage = NonNullable<FunctionReturnType<TrackPageQuery>>;
export type TryoutSetAttemptStatus = NonNullable<TryoutSetRow["attemptStatus"]>;
export type TryoutSetSort = TryoutSetListArgs["sort"];
export type TryoutSetStatusFilter = TryoutSetListArgs["filter"];

export interface TryoutCatalogBootstrap {
  readonly args: TryoutSetListArgs;
  readonly result: TryoutSetPage;
}
