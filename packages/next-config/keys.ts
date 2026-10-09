import { readEnvironment } from "@repo/utilities/env";
import { Schema } from "effect";

const requiredUrlSchema = Schema.String.pipe(
  Schema.check(
    Schema.makeFilter((value) => URL.canParse(value), {
      message: "Expected a valid URL.",
    })
  )
);
const optionalStringSchema = Schema.UndefinedOr(Schema.String);
/** Defines the Aksara token accepted by publication-owned WWW routes. */
export const publicationKeys = () =>
  readEnvironment(
    { AKSARA_PUBLICATION_TOKEN: Schema.NonEmptyString },
    { AKSARA_PUBLICATION_TOKEN: process.env.AKSARA_PUBLICATION_TOKEN }
  );
/** Defines the private token used only by executable-content runtime reads. */
export const contentRuntimeKeys = () =>
  readEnvironment(
    { CONTENT_RUNTIME_TOKEN: Schema.NonEmptyString },
    { CONTENT_RUNTIME_TOKEN: process.env.CONTENT_RUNTIME_TOKEN }
  );
/** Defines the canonical site URL used by server-side absolute URL builders. */
export const siteUrlKeys = () =>
  readEnvironment(
    { SITE_URL: requiredUrlSchema },
    { SITE_URL: process.env.SITE_URL }
  );
/** Reads the Aksara preview fields, each absent unless the development child sets it. */
export const previewKeys = () =>
  readEnvironment(
    {
      AKSARA_PREVIEW_EVENTS_PATH: optionalStringSchema,
      AKSARA_PREVIEW_KEY_ID: optionalStringSchema,
      AKSARA_PREVIEW_MANIFEST_PATH: optionalStringSchema,
      AKSARA_PREVIEW_ORIGIN: optionalStringSchema,
      AKSARA_PREVIEW_PUBLIC_KEY: optionalStringSchema,
      AKSARA_PREVIEW_PROVIDER_TOKEN: optionalStringSchema,
      AKSARA_PREVIEW_RENDERER_SECRET: optionalStringSchema,
      AKSARA_PREVIEW_RENDERER_TOKEN: optionalStringSchema,
    },
    {
      AKSARA_PREVIEW_EVENTS_PATH: process.env.AKSARA_PREVIEW_EVENTS_PATH,
      AKSARA_PREVIEW_KEY_ID: process.env.AKSARA_PREVIEW_KEY_ID,
      AKSARA_PREVIEW_MANIFEST_PATH: process.env.AKSARA_PREVIEW_MANIFEST_PATH,
      AKSARA_PREVIEW_ORIGIN: process.env.AKSARA_PREVIEW_ORIGIN,
      AKSARA_PREVIEW_PUBLIC_KEY: process.env.AKSARA_PREVIEW_PUBLIC_KEY,
      AKSARA_PREVIEW_PROVIDER_TOKEN: process.env.AKSARA_PREVIEW_PROVIDER_TOKEN,
      AKSARA_PREVIEW_RENDERER_SECRET:
        process.env.AKSARA_PREVIEW_RENDERER_SECRET,
      AKSARA_PREVIEW_RENDERER_TOKEN: process.env.AKSARA_PREVIEW_RENDERER_TOKEN,
    }
  );
