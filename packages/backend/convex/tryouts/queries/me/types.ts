import type { userTryoutLookupArgs } from "@repo/backend/convex/tryouts/queries/me/validators";
import type { Infer } from "convex/values";

export type UserTryoutLookup = {
  [Key in keyof typeof userTryoutLookupArgs]: Infer<
    (typeof userTryoutLookupArgs)[Key]
  >;
};
