import { FunctionImpl, GroupImpl } from "@confect/server";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { dispatchProgram } from "@repo/backend/confect/contentRelease/runtime/tryout/dispatch";
import spec from "@repo/backend/confect/contentRelease/runtime/tryout/dispatch.spec";
import { contentKeyResolver } from "@repo/backend/content/trust";
import { Effect, Layer } from "effect";

const dispatch = FunctionImpl.make(
  databaseSchema,
  spec,
  "dispatch",
  Effect.fn("contentRelease.runtime.tryout.dispatch.dispatch")(
    function* (input: {
      readonly byteLength: number;
      readonly source: string;
    }) {
      return yield* dispatchProgram(input.source, input.byteLength).pipe(
        Effect.provideService(
          ContentVerificationKeyResolver,
          contentKeyResolver
        )
      );
    }
  )
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(dispatch),
  GroupImpl.finalize
);
