import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { Email } from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** What the acceptance seed answers: the exam, its sitting, and the sitting's token. */
const SittingSeed = Schema.Struct({
  examId: Id("exams"),
  sittingId: Id("examSittings"),
  token: Schema.String,
});

/**
 * The acceptance seed of school exams. It is internal, so no browser can call it, and only the
 * acceptance command line calls it with the deployment's key (ADR 0013).
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "sitting",
    args: () => ({ email: Email, slug: TenantSlug }),
    returns: () => SittingSeed,
  })
);
