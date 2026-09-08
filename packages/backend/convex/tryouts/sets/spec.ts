import { appLocaleValidator } from "@repo/backend/convex/contentRelease/spec";
import { publicTryoutSetValidator } from "@repo/backend/convex/tryouts/queries/catalogModel";
import { tryoutRouteKeyValidator } from "@repo/backend/convex/tryouts/route";
import { tryoutStatusValidator } from "@repo/backend/convex/tryouts/status";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { type Infer, v } from "convex/values";
import { literals } from "convex-helpers/validators";

export const setDirectionValidator = literals("asc", "desc");

export const setSortValidator = v.object({
  direction: setDirectionValidator,
  field: literals(
    "order",
    "publishedScore",
    "readyQuestionCount",
    "durationSeconds",
    "title"
  ),
});

export const setFilterValidator = literals(
  "all",
  "not-started",
  ...tryoutStatusValidator.members.map(({ value }) => value)
);

export const trackIdentityValidator = v.object({
  countryKey: tryoutRouteKeyValidator,
  examKey: tryoutRouteKeyValidator,
  locale: appLocaleValidator,
  trackKey: tryoutRouteKeyValidator,
});

export const listArgsValidator = v.object({
  ...trackIdentityValidator.fields,
  filter: setFilterValidator,
  paginationOpts: paginationOptsValidator,
  sort: setSortValidator,
});

export const trackSetValidator = v.object({
  ...publicTryoutSetValidator.fields,
  attemptStatus: v.union(v.null(), tryoutStatusValidator),
  durationSeconds: v.number(),
  publishedScore: v.union(v.number(), v.null()),
});

export const trackSetPageValidator = paginationResultValidator(
  trackSetValidator
).extend({
  snapshotId: v.string(),
  viewerId: v.union(v.string(), v.null()),
});

export type ListArgs = Infer<typeof listArgsValidator>;
export type TrackIdentity = Infer<typeof trackIdentityValidator>;

export const emptySetPage = {
  continueCursor: "",
  isDone: true,
  page: [],
};
