import { Schema } from "effect";
/** Original signed bytes returned to the Node artifact verification boundary. */
export const tryoutBodyBatchValidator = Schema.Struct({
  bundleJson: Schema.String,
  items: Schema.mutable(
    Schema.Array(
      Schema.Struct({
        artifactJson: Schema.String,
        delivery: Schema.Union([
          Schema.Literal("authenticated"),
          Schema.Literal("entitled"),
        ]),
        sourcePath: Schema.String,
      })
    )
  ),
  rendererJson: Schema.String,
});
export type TryoutBodyBatch = Schema.Schema.Type<
  typeof tryoutBodyBatchValidator
>;
