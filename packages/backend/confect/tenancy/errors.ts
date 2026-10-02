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
