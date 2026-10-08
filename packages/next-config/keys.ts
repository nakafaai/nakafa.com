import { createEnv } from "@t3-oss/env-nextjs";
import { Schema } from "effect";

const requiredStringSchema = Schema.toStandardSchemaV1(Schema.NonEmptyString);
const requiredUrlSchema = Schema.toStandardSchemaV1(
  Schema.String.pipe(
    Schema.check(
      Schema.makeFilter((value) => URL.canParse(value), {
        message: "Expected a valid URL.",
      })
    )
  )
);
const optionalStringSchema = Schema.toStandardSchemaV1(
  Schema.UndefinedOr(Schema.String)
);
/** Defines the Aksara token accepted by publication-owned WWW routes. */
export const publicationKeys = () =>
  createEnv({
    server: {
      AKSARA_PUBLICATION_TOKEN: requiredStringSchema,
    },
    runtimeEnv: {
      AKSARA_PUBLICATION_TOKEN: process.env.AKSARA_PUBLICATION_TOKEN,
    },
  });
/** Defines the private token used only by executable-content runtime reads. */
export const contentRuntimeKeys = () =>
  createEnv({
    server: {
      CONTENT_RUNTIME_TOKEN: requiredStringSchema,
    },
    runtimeEnv: {
      CONTENT_RUNTIME_TOKEN: process.env.CONTENT_RUNTIME_TOKEN,
    },
  });
/** Reads the private target required by signed public content consumers. */
export function readContentRuntimeTarget(siteUrl: string) {
  const keys = contentRuntimeKeys();
  return {
    siteUrl,
    token: keys.CONTENT_RUNTIME_TOKEN,
  };
}
/** Defines the canonical site URL used by server-side absolute URL builders. */
export const siteUrlKeys = () =>
  createEnv({
    server: {
      SITE_URL: requiredUrlSchema,
    },
    runtimeEnv: {
      SITE_URL: process.env.SITE_URL,
    },
  });
/** Defines the public app origin that client and server absolute URL builders share. */
export const appUrlKeys = () =>
  createEnv({
    client: {
      NEXT_PUBLIC_APP_URL: requiredStringSchema,
    },
    runtimeEnv: {
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    },
  });
/** Reads the Aksara preview fields, each absent unless the development child sets it. */
export const previewKeys = () =>
  createEnv({
    server: {
      AKSARA_PREVIEW_EVENTS_PATH: optionalStringSchema,
      AKSARA_PREVIEW_KEY_ID: optionalStringSchema,
      AKSARA_PREVIEW_MANIFEST_PATH: optionalStringSchema,
      AKSARA_PREVIEW_ORIGIN: optionalStringSchema,
      AKSARA_PREVIEW_PUBLIC_KEY: optionalStringSchema,
      AKSARA_PREVIEW_PROVIDER_TOKEN: optionalStringSchema,
      AKSARA_PREVIEW_RENDERER_SECRET: optionalStringSchema,
      AKSARA_PREVIEW_RENDERER_TOKEN: optionalStringSchema,
    },
    runtimeEnv: {
      AKSARA_PREVIEW_EVENTS_PATH: process.env.AKSARA_PREVIEW_EVENTS_PATH,
      AKSARA_PREVIEW_KEY_ID: process.env.AKSARA_PREVIEW_KEY_ID,
      AKSARA_PREVIEW_MANIFEST_PATH: process.env.AKSARA_PREVIEW_MANIFEST_PATH,
      AKSARA_PREVIEW_ORIGIN: process.env.AKSARA_PREVIEW_ORIGIN,
      AKSARA_PREVIEW_PUBLIC_KEY: process.env.AKSARA_PREVIEW_PUBLIC_KEY,
      AKSARA_PREVIEW_PROVIDER_TOKEN: process.env.AKSARA_PREVIEW_PROVIDER_TOKEN,
      AKSARA_PREVIEW_RENDERER_SECRET:
        process.env.AKSARA_PREVIEW_RENDERER_SECRET,
      AKSARA_PREVIEW_RENDERER_TOKEN: process.env.AKSARA_PREVIEW_RENDERER_TOKEN,
    },
  });
