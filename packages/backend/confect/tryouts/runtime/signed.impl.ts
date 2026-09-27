import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { stageTryoutRuntimeBundleProgram } from "@repo/backend/confect/tryouts/runtime/signed";
import spec from "@repo/backend/confect/tryouts/runtime/signed.spec";
import { Effect, Layer } from "effect";

const stageTryoutRuntimeBundle = FunctionImpl.make(
  databaseSchema,
  spec,
  "stageTryoutRuntimeBundle",
  Effect.fn("tryouts.runtime.signed.stageTryoutRuntimeBundle")(
    function* (args) {
      return yield* stageTryoutRuntimeBundleProgram(
        args.bundleJson,
        args.rendererJson
      );
    }
  )
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(stageTryoutRuntimeBundle),
  GroupImpl.finalize
);
