import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { envelopeProgram } from "@repo/backend/confect/contentRelease/envelope";
import spec from "@repo/backend/confect/contentRelease/envelope.spec";
import { loadRelease } from "@repo/backend/confect/contentRelease/model";
import { Effect, Layer } from "effect";

const get = FunctionImpl.make(
  databaseSchema,
  spec,
  "get",
  Effect.fn("contentRelease.envelope.get")(function* (args) {
    return yield* envelopeProgram(args.releaseId, args.manifestHash);
  })
);
const byRelease = FunctionImpl.make(
  databaseSchema,
  spec,
  "byRelease",
  Effect.fn("contentRelease.envelope.byRelease")(function* (args) {
    return yield* loadRelease(args.releaseId).pipe(
      Effect.map((release) => ({
        releaseJson: release.releaseJson,
        rendererJson: release.rendererJson,
        role: release.role,
      }))
    );
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(get),
  Layer.provide(byRelease),
  GroupImpl.finalize
);
