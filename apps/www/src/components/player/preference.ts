import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { PlayerModeSchema } from "@/components/player/mode";

/**
 * Remembers the view a learner chose, so the server renders it first on their
 * next page. A server function is the framework boundary for writing a cookie:
 * the browser cannot write an `httpOnly` cookie. The argument arrives from the
 * network, so the validator decodes it before the handler stores it.
 */
export const savePlayerMode = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(PlayerModeSchema))
  .handler(async (options) => {
    const { savePlayerModeHandler } = await import(
      "@/components/player/preference.server"
    );
    return savePlayerModeHandler(options);
  });
