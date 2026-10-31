import { FunctionSpec, GroupSpec } from "@confect/core";
import {
  OwnPracticeView,
  PracticeTopic,
} from "@repo/backend/confect/insight/schema";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * A student's private practice in School Insight (ADR 0012, ADR 0035): it stays out until the student shares a topic,
 * and the student can stop sharing it at any time.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicQuery({
      name: "topics",
      args: () => ({ slug: TenantSlug }),
      returns: () => Schema.Array(OwnPracticeView),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "share",
      args: () => ({ ...PracticeTopic.fields, slug: TenantSlug }),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "stop",
      args: () => ({ ...PracticeTopic.fields, slug: TenantSlug }),
      returns: () => Schema.Null,
    })
  );
