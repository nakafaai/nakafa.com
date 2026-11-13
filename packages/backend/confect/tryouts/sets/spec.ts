import { PaginationOptions as PaginationOptionsSchema } from "@confect/core/PaginationOptions";
import { PaginationResult as PaginationResultSchema } from "@confect/core/PaginationResult";
import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import {
  publicTryoutSectionValidator,
  publicTryoutSetValidator,
} from "@repo/backend/confect/tryouts/queries/model";
import { tryoutRouteKeyValidator } from "@repo/backend/confect/tryouts/route";
import {
  setFilterValidator,
  setSortValidator,
} from "@repo/backend/confect/tryouts/sets/query";
import { tryoutStatusValidator } from "@repo/backend/confect/tryouts/status";
import { Schema } from "effect";

const trackIdentityValidator = Schema.Struct({
  countryKey: tryoutRouteKeyValidator,
  examKey: tryoutRouteKeyValidator,
  locale: ActiveAppLocaleCodeSchema,
  trackKey: tryoutRouteKeyValidator,
});
export const listArgsValidator = Schema.Struct({
  ...trackIdentityValidator.fields,
  filter: setFilterValidator,
  paginationOpts: PaginationOptionsSchema,
  sort: setSortValidator,
});
/** The page a running attempt continues on, so a set row can open it directly. */
export const runningAttemptValidator = Schema.Struct({
  attemptId: IdSchema("tryoutAttempts"),
  publicPath: Schema.String,
});
/**
 * One set of a track as its table and its pane show it: the set, the learner's progress, the section a start
 * enters, and the sections a visitor sees, so the pane names its parts and starts it without reading the set
 * page.
 */
const trackSetValidator = Schema.Struct({
  ...publicTryoutSetValidator.fields,
  attemptStatus: Schema.Union([Schema.Null, tryoutStatusValidator]),
  durationSeconds: Schema.Finite,
  entrySection: publicTryoutSectionValidator,
  publishedScore: Schema.Union([Schema.Finite, Schema.Null]),
  runningAttempt: Schema.Union([Schema.Null, runningAttemptValidator]),
  sections: Schema.Array(publicTryoutSectionValidator),
});
export const trackSetPageValidator = Schema.Struct({
  ...PaginationResultSchema(trackSetValidator).fields,
  ...{
    snapshotId: Schema.String,
    viewerId: Schema.Union([Schema.String, Schema.Null]),
  },
});
export type ListArgs = typeof listArgsValidator.Type;
export type TrackIdentity = typeof trackIdentityValidator.Type;
export const emptySetPage = {
  continueCursor: "",
  isDone: true,
  page: [],
};
/** Stable client failure for invalid signed-catalog pagination. */
export class PublishedSetPaginationError extends Schema.TaggedError<
  PublishedSetPaginationError,
  { readonly brand: unique symbol }
>()("PublishedSetPaginationError", {
  code: Schema.Literals([
    "INVALID_TRYOUT_SET_CURSOR",
    "INVALID_TRYOUT_SET_PAGE_SIZE",
  ]),
  message: Schema.String,
}) {}
/** Paginates one signed list and invalidates cursors when its rows move. */
/** Public failure payload keeps the domain tag while preserving the deployed code/message transport. */
