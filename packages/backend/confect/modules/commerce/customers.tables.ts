import { GenericId } from "@confect/core";
import { Table } from "@confect/server";
import { Schema } from "effect";

/**
 * Polar metadata validator.
 * Polar stores flat primitive metadata values.
 */
export const polarMetadataSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Union(Schema.String, Schema.Number, Schema.Boolean),
});

/** customers table definition. */
export const Customers = Table.make(
  "customers",
  Schema.Struct({
    id: Schema.String,
    externalId: Schema.NullOr(Schema.String),
    userId: GenericId.GenericId("users"),
    metadata: Schema.optional(polarMetadataSchema),
  })
)
  .index("by_userId", ["userId"])
  .index("by_polarId", ["id"]);

export const tables = [Customers] as const;
