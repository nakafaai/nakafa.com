import { FunctionSpec, GroupSpec } from "@confect/core";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantNotFound } from "@repo/backend/confect/tenancy/errors";
import { TenantProfile } from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "get",
      args: () => ({ slug: TenantSlug }),
      returns: () => TenantProfile,
      error: () => TenantNotFound,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "refusal",
      args: () => ({ slug: TenantSlug }),
      returns: () => Schema.Boolean,
    }).middleware(Session)
  );
