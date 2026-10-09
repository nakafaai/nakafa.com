import type { Ref } from "@confect/core";
import type tryouts from "@repo/backend/confect/_generated/refs/tryouts";

type SetListQuery = typeof tryouts.queries.sets.list;
type TrackPageQuery = typeof tryouts.queries.catalog.getTrackPage;

/** Number of additional sets requested by each discovery window. */
export const TRYOUT_SET_PAGE_SIZE = 25;

export type TryoutSetListArgs = Ref.Args<SetListQuery>;
export type TryoutSetPage = Ref.Returns<SetListQuery>;
export type TryoutSetRow = TryoutSetPage["page"][number];
export type TryoutTrackPage = NonNullable<Ref.Returns<TrackPageQuery>>;
export type TryoutSetAttemptStatus = NonNullable<TryoutSetRow["attemptStatus"]>;
export type TryoutSetSort = TryoutSetListArgs["sort"];
export type TryoutSetStatusFilter = TryoutSetListArgs["filter"];
