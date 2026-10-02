import { Schema } from "effect";

/** No tenant has this address. */
export class TenantNotFound extends Schema.TaggedError<TenantNotFound>()(
  "TenantNotFound",
  {
    code: Schema.Literal("TENANT_NOT_FOUND"),
    message: Schema.String,
  }
) {}
