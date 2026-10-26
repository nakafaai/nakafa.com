import { MaterialLessonProjectionSchema } from "@nakafa/aksara-contracts/projection/material";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

const { contentKey, materialKey, parentPath, publicPath } =
  MaterialLessonProjectionSchema.fields;

/** One lesson's identity, as its page holds it, and the `ctx` hint of the reader's address. */
export const PlacementInput = Schema.Struct({
  contentKey,
  ctx: Schema.String,
  locale: Schema.String,
  materialKey,
  parentPath,
  publicPath,
});

/**
 * Reads the verified curriculum placement that the `ctx` hint of a lesson's
 * address names. The build writes a lesson before any reader picks a
 * curriculum, so its page carries no hint, and the browser asks once the page
 * has hydrated. No build answers a reader's hint, so the Worker reads it from
 * Convex (ADR 0038 D6).
 */
export const readMaterialPlacement = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(PlacementInput))
  .handler(async ({ data }) => {
    const { readPlacementHandler } = await import(
      "@/lib/content/material/placement.server"
    );
    return readPlacementHandler({ data });
  });
