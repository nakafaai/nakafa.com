import { PaginationOptions as PaginationOptionsSchema } from "@confect/core/PaginationOptions";
import { PaginationResult as PaginationResultSchema } from "@confect/core/PaginationResult";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import { publicTryoutSetValidator } from "@repo/backend/confect/tryouts/queries/catalogModel";
import { tryoutRouteKeyValidator } from "@repo/backend/confect/tryouts/route";
import { tryoutStatusValidator } from "@repo/backend/confect/tryouts/status";
import { Schema } from "effect";
export const setDirectionValidator = Schema.Literals(["asc", "desc"]);
export const setSortValidator = Schema.Struct({
  direction: setDirectionValidator,
  field: Schema.Literals([
    "order",
    "publishedScore",
    "readyQuestionCount",
    "durationSeconds",
    "title",
  ]),
});
export const setFilterValidator = Schema.Literals([
  "all",
  "not-started",
  ...tryoutStatusValidator.literals,
]);
const trackIdentityValidator = Schema.Struct({
  countryKey: tryoutRouteKeyValidator,
  examKey: tryoutRouteKeyValidator,
  locale: appLocaleValidator,
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
const trackSetValidator = Schema.Struct({
  ...publicTryoutSetValidator.fields,
  attemptStatus: Schema.Union([Schema.Null, tryoutStatusValidator]),
  durationSeconds: Schema.Finite,
  publishedScore: Schema.Union([Schema.Finite, Schema.Null]),
  runningAttempt: Schema.Union([Schema.Null, runningAttemptValidator]),
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
export class PublishedSetPaginationError extends Schema.TaggedError<PublishedSetPaginationError>()(
  "PublishedSetPaginationError",
  {
    code: Schema.Literals([
      "INVALID_TRYOUT_SET_CURSOR",
      "INVALID_TRYOUT_SET_PAGE_SIZE",
    ]),
    message: Schema.String,
  }
) {}
/** Paginates one signed list and invalidates cursors when its rows move. */
/** Public failure payload keeps the domain tag while preserving the deployed code/message transport. */
