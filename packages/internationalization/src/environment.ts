import { createEnv } from "@t3-oss/env-nextjs";
import { Schema } from "effect";

const optionalStringSchema = Schema.toStandardSchemaV1(
  Schema.UndefinedOr(Schema.String)
);

/** Reads the Aksara preview connection fields that a development child may set. */
const candidateLocalePreviewKeys = () =>
  createEnv({
    server: {
      AKSARA_PREVIEW_EVENTS_PATH: optionalStringSchema,
      AKSARA_PREVIEW_KEY_ID: optionalStringSchema,
      AKSARA_PREVIEW_MANIFEST_PATH: optionalStringSchema,
      AKSARA_PREVIEW_ORIGIN: optionalStringSchema,
      AKSARA_PREVIEW_PUBLIC_KEY: optionalStringSchema,
      AKSARA_PREVIEW_PROVIDER_TOKEN: optionalStringSchema,
    },
    runtimeEnv: {
      AKSARA_PREVIEW_EVENTS_PATH: process.env.AKSARA_PREVIEW_EVENTS_PATH,
      AKSARA_PREVIEW_KEY_ID: process.env.AKSARA_PREVIEW_KEY_ID,
      AKSARA_PREVIEW_MANIFEST_PATH: process.env.AKSARA_PREVIEW_MANIFEST_PATH,
      AKSARA_PREVIEW_ORIGIN: process.env.AKSARA_PREVIEW_ORIGIN,
      AKSARA_PREVIEW_PUBLIC_KEY: process.env.AKSARA_PREVIEW_PUBLIC_KEY,
      AKSARA_PREVIEW_PROVIDER_TOKEN: process.env.AKSARA_PREVIEW_PROVIDER_TOKEN,
    },
  });

/** Allows contract-supported route locales only inside an Aksara dev child. */
export function hasCandidateLocalePreview() {
  if (process.env.NODE_ENV !== "development") {
    return false;
  }

  const keys = candidateLocalePreviewKeys();
  return [
    keys.AKSARA_PREVIEW_EVENTS_PATH,
    keys.AKSARA_PREVIEW_KEY_ID,
    keys.AKSARA_PREVIEW_MANIFEST_PATH,
    keys.AKSARA_PREVIEW_ORIGIN,
    keys.AKSARA_PREVIEW_PUBLIC_KEY,
    keys.AKSARA_PREVIEW_PROVIDER_TOKEN,
  ].some((value) => value !== undefined);
}
