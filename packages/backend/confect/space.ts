import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/** Whose data a row belongs to: one account, or one school tenant. */
export const Space = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("personal"), userId: Id("users") }),
  Schema.Struct({ kind: Schema.Literal("tenant"), tenantId: Id("tenants") }),
]);
export type Space = typeof Space.Type;
