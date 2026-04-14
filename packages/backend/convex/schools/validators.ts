import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";

/** Lightweight school identity payload used by slug lookups. */
export const schoolInfoResultValidator = v.object({
  name: v.string(),
});

/** Authenticated school route snapshot returned by slug lookups. */
export const schoolBySlugResultValidator = v.object({
  school: vv.doc("schools"),
  membership: vv.doc("schoolMembers"),
});

/** Shared return payload for school create and join flows. */
export const schoolIdentityResultValidator = v.object({
  schoolId: vv.id("schools"),
  slug: v.string(),
});
