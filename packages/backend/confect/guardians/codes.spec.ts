import { FunctionSpec, GroupSpec } from "@confect/core";
import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import {
  CodeRedeem,
  CodeSent,
  RedeemAnswer,
} from "@repo/backend/confect/guardians/schema";
import { Email } from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The guardian's email code (ADR 0009, ADR 0034). A visitor of the school host asks
 * for a code at `/orang-tua`, and the sign-in endpoint of that host redeems it. No
 * other host and no session reach the redeem, which is internal.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicMutation({
      name: "send",
      args: () => ({
        deviceId: Schema.String.check(Schema.isUUID()),
        email: Email,
        locale: ActiveAppLocaleCodeSchema,
        slug: TenantSlug,
      }),
      returns: () => CodeSent,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "redeem",
      args: () => CodeRedeem.fields,
      returns: () => RedeemAnswer,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "sweep",
      args: () => ({}),
      returns: () => Schema.Null,
    })
  );
