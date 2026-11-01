import { FunctionSpec, GroupSpec } from "@confect/core";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import {
  PreferenceChannel,
  SwitchedOff,
} from "@repo/backend/confect/notifications/preference";
import { NoticeKind } from "@repo/backend/confect/notifications/rules";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * What a member switched off, for each kind of notice and each channel (ADR 0027). The inbox row always stays, and a
 * channel the rules always send refuses nothing and stays on.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicQuery({
      name: "list",
      args: () => ({ slug: TenantSlug }),
      returns: () => Schema.Array(SwitchedOff),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "set",
      args: () => ({
        channel: PreferenceChannel,
        kind: NoticeKind,
        on: Schema.Boolean,
        slug: TenantSlug,
      }),
      returns: () => Schema.Null,
    })
  );
