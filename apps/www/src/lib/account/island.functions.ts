import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { LocaleInput, ProfileInput } from "@/lib/account/input";

/** The world game: the learner's level, blueprints and what their land's seed is made from. */
export const islandScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(LocaleInput))
  .handler(async (options) => {
    const { islandScreenHandler } = await import("@/lib/account/island.server");
    return islandScreenHandler(options);
  });

/** A visit to another learner's world: whose it is, when it opens to the visitor. */
export const worldScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ProfileInput))
  .handler(async (options) => {
    const { worldScreenHandler } = await import("@/lib/account/island.server");
    return worldScreenHandler(options);
  });
