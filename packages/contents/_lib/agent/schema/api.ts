import { NAKAFA_PUBLIC_API_VERSION } from "@repo/contents/_lib/agent/constants";
import { Schema, Struct } from "effect";

const HttpsUrlSchema = Schema.String.pipe(
  Schema.check(
    Schema.makeFilter(
      (value) => URL.canParse(value) && new URL(value).protocol === "https:",
      { message: "Expected a valid HTTPS URL." }
    )
  )
);

/** Machine-readable index returned by the Nakafa public API root. */
export const NakafaApiIndexSchema = Schema.Struct({
  authentication: Schema.Literal("none"),
  description: Schema.String,
  documentation: HttpsUrlSchema,
  mcp: HttpsUrlSchema,
  name: Schema.Literal("Nakafa Public API"),
  openapi: HttpsUrlSchema,
  status: Schema.Literal("active"),
  version: Schema.Literal(NAKAFA_PUBLIC_API_VERSION),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));

/** Stable health response for monitors and agent clients. */
export const NakafaApiHealthSchema = Schema.Struct({
  service: Schema.Literal("nakafa-public-api"),
  status: Schema.Literal("ok"),
  timestamp: Schema.Finite.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThan(0))
  ),
  version: Schema.Literal(NAKAFA_PUBLIC_API_VERSION),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));

/** RFC 9457 response with stable machine recovery fields. */
export const NakafaProblemDetailsSchema = Schema.Struct({
  code: Schema.String,
  detail: Schema.String,
  instance: Schema.String,
  request_id: Schema.String,
  resolution: Schema.String,
  status: Schema.Finite.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isBetween({ minimum: 400, maximum: 599 }))
  ),
  title: Schema.String,
  type: HttpsUrlSchema,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));

export type NakafaProblemDetails = Schema.Schema.Type<
  typeof NakafaProblemDetailsSchema
>;
