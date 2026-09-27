import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  MutationCtx as MutationCtxService,
} from "@repo/backend/confect/_generated/services";
import { deleteForumPendingUpload } from "@repo/backend/confect/classes/forums/attachments/impl";
import spec from "@repo/backend/confect/classes/forums/internalMutations.spec";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import { Effect, Layer } from "effect";

const deleteExpiredPendingUpload = FunctionImpl.make(
  databaseSchema,
  spec,
  "deleteExpiredPendingUpload",
  Effect.fn("classes.forums.internalMutations.deleteExpiredPendingUpload")(
    function* (args) {
      const database = yield* DatabaseReader;
      const ctx = yield* MutationCtxService;
      const upload = yield* database
        .table("schoolClassForumPendingUploads")
        .get(args.uploadId)
        .pipe(
          Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
          Effect.orDie
        );
      if (!upload) {
        return null;
      }
      yield* deleteForumPendingUpload(ctx, upload);
      return null;
    }
  )
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(deleteExpiredPendingUpload),
  Layer.provide(atomic),
  GroupImpl.finalize
);
