import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { LocaleInput } from "@/lib/account/input";

/** The island game: the learner's level, footprint and seed. */
export const islandScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(LocaleInput))
  .handler(async (options) => {
    const { islandScreenHandler } = await import("@/lib/account/island.server");
    return islandScreenHandler(options);
  });
