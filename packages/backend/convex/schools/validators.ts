import { vv } from "@repo/backend/convex/lib/validators/vv";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";

/** Authenticated school route snapshot returned by slug lookups. */
export const schoolBySlugResultValidator = v.object({
  school: vv.doc("schools"),
  membership: vv.doc("schoolMembers"),
});

/** Minimal school fields used by switchers and selection lists. */
export const schoolSummaryValidator = v.object({
  _id: vv.id("schools"),
  name: v.string(),
  slug: v.string(),
  type: vv.doc("schools").fields.type,
});

/** Paginated args for the current user's school list. */
export const mySchoolsPageArgs = {
  paginationOpts: paginationOptsValidator,
};

/** Paginated result for school summaries. */
export const mySchoolsPageResultValidator = paginationResultValidator(
  schoolSummaryValidator
);

/** Landing state for the public `/school` entry route. */
export const schoolLandingStateResultValidator = v.union(
  v.object({
    kind: v.literal("none"),
  }),
  v.object({
    kind: v.literal("single"),
    slug: v.string(),
  }),
  v.object({
    kind: v.literal("multiple"),
  })
);

/** Shared return payload for school create and join flows. */
export const schoolIdentityResultValidator = v.object({
  schoolId: vv.id("schools"),
  slug: v.string(),
});
