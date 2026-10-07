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
