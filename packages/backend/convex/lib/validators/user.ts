import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";
import { nullable } from "convex-helpers/validators";

/** Shared public-safe user snapshot validator for joined response payloads. */
export const userDataValidator = v.object({
  _id: vv.id("users"),
  name: v.string(),
  email: v.string(),
  image: v.optional(nullable(v.string())),
});
