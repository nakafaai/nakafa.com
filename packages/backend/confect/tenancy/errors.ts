import { Effect, Schema } from "effect";

const tenantNotFound = Schema.Literal("TENANT_NOT_FOUND");

/** No tenant has this address. */
export class TenantNotFound extends Schema.TaggedError<TenantNotFound>()(
  "TenantNotFound",
  {
    code: tenantNotFound.pipe(
      Schema.withConstructorDefault(Effect.succeed(tenantNotFound.literal))
    ),
    message: Schema.String.pipe(
      Schema.withConstructorDefault(
        Effect.succeed("No school has this address.")
      )
    ),
  }
) {}

/**
 * An organisation that Nakafa refuses to open: `SLUG_TAKEN` another tenant has
 * the address, `SLUG_RESERVED` the address belongs to Nakafa itself,
 * `UNIT_REQUIRED` no school was named, `UNIT_LIMIT` more schools than one
 * organisation holds.
 */
export class ProvisionRejected extends Schema.TaggedError<ProvisionRejected>()(
  "ProvisionRejected",
  {
    code: Schema.Literals([
      "SLUG_TAKEN",
      "SLUG_RESERVED",
      "UNIT_REQUIRED",
      "UNIT_LIMIT",
    ]),
    message: Schema.String,
  }
) {}
