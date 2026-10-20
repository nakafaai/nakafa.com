import type { Ref } from "@confect/core";
import type tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import {
  setDirectionValidator,
  setFilterValidator,
  setSortValidator,
} from "@repo/backend/confect/tryouts/sets/spec";
import { Schema } from "effect";

type SetListQuery = typeof tryouts.queries.sets.list;

/** Number of additional sets requested by each discovery window. */
export const TRYOUT_SET_PAGE_SIZE = 25;

export type TryoutSetListArgs = Ref.Args<SetListQuery>;
export type TryoutSetPage = Ref.Returns<SetListQuery>;
export type TryoutSetRow = TryoutSetPage["page"][number];
export type TryoutSetSort = TryoutSetListArgs["sort"];
export type TryoutSetStatusFilter = TryoutSetListArgs["filter"];

/** The set list request of a track, without the window of rows it reads. */
export type TryoutSetRequest = Omit<TryoutSetListArgs, "paginationOpts">;

/** One change of the catalog's URL selection: its status filter, its sort field or its direction. */
export const TryoutSetSelectionChange = Schema.Struct({
  direction: Schema.optionalKey(setDirectionValidator),
  sort: Schema.optionalKey(setSortValidator.fields.field),
  status: Schema.optionalKey(setFilterValidator),
});
export type TryoutSetSelectionChange = typeof TryoutSetSelectionChange.Type;

/** What the table shows for one request: its rows, their paging and their status. */
export interface TryoutSetData {
  readonly busy: boolean;
  readonly error: boolean;
  readonly hasMore: boolean;
  readonly loadMore: () => void;
  readonly offline: boolean;
  readonly rows: readonly TryoutSetRow[];
  readonly snapshotId: string | undefined;
}
