import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/**
 * One file Nakafa keeps in the private R2 bucket (ADR 0028): its object key, its size and type, and the school it
 * is charged to. Its ID stands where a Convex storage ID stood. A file is `reserved` from the moment its upload
 * address is signed and `stored` once the server saw its bytes or wrote them itself.
 */
export const fileValidator = Schema.Struct({
  byteSize: Schema.Int.check(Schema.isGreaterThan(0)),
  contentType: Schema.String,
  createdAt: Schema.Finite,
  objectKey: Schema.String,
  state: Schema.Literals(["reserved", "stored"]),
  tenantId: Schema.optionalKey(Id("tenants")),
});
