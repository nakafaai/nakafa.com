import { Schema } from "effect";

/** Direction used by school-domain reorder mutations. */
export const orderDirectionSchema = Schema.Literal("up", "down");

export type OrderDirection = Schema.Schema.Type<typeof orderDirectionSchema>;
