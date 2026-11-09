import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { ProfileInput } from "@/lib/account/input";

/** Another learner's shared island: its cells, seed, footprint and level, or none when it is closed. */
export const visitScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ProfileInput))
  .handler(async (options) => {
    const { visitScreenHandler } = await import("@/lib/account/visit.server");
    return visitScreenHandler(options);
  });
