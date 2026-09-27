import { FunctionImpl, GroupImpl } from "@confect/server";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { ActionCtx as ActionCtxService } from "@repo/backend/confect/_generated/services";
import {
  type DispatchInput,
  dispatchPublication,
} from "@repo/backend/confect/contentRelease/ingress/dispatch";
import spec from "@repo/backend/confect/contentRelease/ingress/dispatch.spec";
import { contentKeyResolver } from "@repo/backend/content/trust";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

const dispatch = FunctionImpl.make(
  databaseSchema,
  spec,
  "dispatch",
  Effect.fn("contentRelease.ingress.dispatch.dispatch")(function* (
    input: DispatchInput
  ) {
    const ctx: ActionCtx = yield* ActionCtxService;
    return yield* dispatchPublication(ctx, input).pipe(
      Effect.provideService(ContentVerificationKeyResolver, contentKeyResolver),
      Effect.provide(FetchHttpClient.layer)
    );
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(dispatch),
  GroupImpl.finalize
);
