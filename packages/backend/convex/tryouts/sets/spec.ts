import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { publicTryoutSetValidator } from "@repo/backend/convex/tryouts/queries/catalogModel";
import {
  tryoutRouteKeyValidator,
  tryoutStatusValidator,
} from "@repo/backend/convex/tryouts/schema";
import { paginationOptsValidator } from "convex/server";
import { type Infer, v } from "convex/values";
import { literals } from "convex-helpers/validators";

export const setDirectionValidator = literals("asc", "desc");

export const setSortValidator = v.object({
  direction: setDirectionValidator,
  field: literals("order", "publishedScore", "readyQuestionCount", "title"),
});

export const trackIdentityValidator = v.object({
  countryKey: tryoutRouteKeyValidator,
  examKey: tryoutRouteKeyValidator,
  locale: localeValidator,
  trackKey: tryoutRouteKeyValidator,
});

export const listArgsValidator = v.object({
  ...trackIdentityValidator.fields,
  paginationOpts: paginationOptsValidator,
  sort: setSortValidator,
});

export const statusArgsValidator = v.object({
  ...trackIdentityValidator.fields,
  paginationOpts: paginationOptsValidator,
  status: tryoutStatusValidator,
});

export const unattemptedArgsValidator = v.object({
  ...trackIdentityValidator.fields,
  paginationOpts: paginationOptsValidator,
});

export const trackSetValidator = v.object({
  ...publicTryoutSetValidator.fields,
  attemptStatus: v.union(v.null(), tryoutStatusValidator),
  publishedScore: v.union(v.number(), v.null()),
});

export type ListArgs = Infer<typeof listArgsValidator>;
export type StatusArgs = Infer<typeof statusArgsValidator>;
export type TrackIdentity = Infer<typeof trackIdentityValidator>;
export type UnattemptedArgs = Infer<typeof unattemptedArgsValidator>;

export const emptySetPage = {
  continueCursor: "",
  isDone: true,
  page: [],
};
