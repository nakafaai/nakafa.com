import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionArgs, FunctionReturnType } from "convex/server";

type SetListQuery = typeof api.tryouts.queries.sets.list;
type SetStatusQuery = typeof api.tryouts.queries.sets.byStatus;
type TrackPageQuery = typeof api.tryouts.queries.catalog.getTrackPage;

/** Number of sets in each client-paginated catalog page. */
export const TRYOUT_SET_PAGE_SIZE = 25;

export type TryoutSetListArgs = FunctionArgs<SetListQuery>;
export type TryoutSetRow = FunctionReturnType<SetListQuery>["page"][number];
export type TryoutTrackPage = NonNullable<FunctionReturnType<TrackPageQuery>>;
export type TryoutSetAttemptStatus = FunctionArgs<SetStatusQuery>["status"];
export type TryoutSetSort = TryoutSetListArgs["sort"];
export type TryoutSetStatusFilter =
  | "all"
  | "not-started"
  | TryoutSetAttemptStatus;
