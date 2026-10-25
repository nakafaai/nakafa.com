import { Schema } from "effect";

/**
 * The file of the public paths that the build prerenders. The Vite config imports
 * this module, so it stays free of the release readers and every runtime import.
 */
export const PrerenderedPagesJson = Schema.fromJsonString(
  Schema.Array(Schema.String)
);
