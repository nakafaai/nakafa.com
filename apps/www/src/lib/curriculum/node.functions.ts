import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";

/** The address of one curriculum node: its curriculum, its locale and the path below it. */
export const CurriculumInput = Schema.Struct({
  curriculum: Schema.String,
  locale: Schema.String,
  path: Schema.Array(Schema.String),
});

/**
 * Reads one curriculum node for a loader. The handler lives in the server module,
 * which this imports only when it runs, so the browser's bundle never carries it.
 */
export const readCurriculumRoute = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(CurriculumInput))
  .handler(async (options) => {
    const { readCurriculumRouteHandler } = await import(
      "@/lib/curriculum/node.server"
    );
    return readCurriculumRouteHandler(options);
  });
