import { ProtectedContentDeliverySchema } from "@nakafa/aksara-contracts/delivery";
import { Schema } from "effect";
/** Original signed bytes returned to the Node artifact verification boundary. */
export const tryoutBodyBatchValidator = Schema.Struct({
  bundleJson: Schema.String,
  items: Schema.mutable(
    Schema.Array(
      Schema.Struct({
        artifactJson: Schema.String,
        delivery: ProtectedContentDeliverySchema,
        sourcePath: Schema.String,
      })
    )
  ),
  rendererJson: Schema.String,
});
export type TryoutBodyBatch = typeof tryoutBodyBatchValidator.Type;
