import { FunctionImpl, GroupImpl } from "@confect/server";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { ActionCtx as ActionCtxService } from "@repo/backend/confect/_generated/services";
import { dispatchProgram } from "@repo/backend/confect/contentRelease/runtime/tryout/dispatch";
import spec from "@repo/backend/confect/contentRelease/runtime/tryout/dispatch.spec";
import { contentKeyResolver } from "@repo/backend/content/trust";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
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
      const ctx: ActionCtx = yield* ActionCtxService;
      return yield* dispatchProgram(ctx, input.source, input.byteLength).pipe(
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
