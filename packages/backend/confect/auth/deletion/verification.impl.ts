import {
  DatabaseReader,
  DatabaseWriter,
  FunctionImpl,
  GroupImpl,
  MutationRunner,
  QueryRunner,
} from "@confect/server";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  ActionCtx as ActionCtxService,
  MutationCtx as MutationCtxService,
  QueryCtx as QueryCtxService,
} from "@repo/backend/confect/_generated/services";
import {
  toUserCleanupError,
  tryUserCleanup,
} from "@repo/backend/confect/auth/cleanup/spec";
import { drainDeletedUserVerificationsProgram } from "@repo/backend/confect/auth/deletion/verification";
import spec from "@repo/backend/confect/auth/deletion/verification.spec";
import { Effect, flow, Layer } from "effect";

const loadDeletedUserVerificationCursor = FunctionImpl.make(
  databaseSchema,
  spec,
  "loadDeletedUserVerificationCursor",
  Effect.fn("auth.deletion.verification.loadDeletedUserVerificationCursor")(
    function* (args) {
      const ctx = yield* QueryCtxService;
      const database = DatabaseReader.make(databaseSchema, ctx.db);
      const user = yield* database
        .table("users")
        .get(args.userId)
        .pipe(
          Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
          Effect.orDie
        );
      return user?.authVerificationCleanupCursor ?? null;
    }
  )
);
const saveDeletedUserVerificationCursor = FunctionImpl.make(
  databaseSchema,
  spec,
  "saveDeletedUserVerificationCursor",
  Effect.fn("auth.deletion.verification.saveDeletedUserVerificationCursor")(
    function* (args) {
      const ctx = yield* MutationCtxService;
      const database = DatabaseReader.make(databaseSchema, ctx.db);
      const writer = DatabaseWriter.make(databaseSchema, ctx.db);
      const user = yield* database
        .table("users")
        .get(args.userId)
        .pipe(
          Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
          Effect.orDie
        );
      if (!user || user.deletedAt === undefined) {
        return null;
      }
      yield* writer
        .table("users")
        .patch(user._id, {
          authVerificationCleanupCursor: args.cursor ?? undefined,
        })
        .pipe(Effect.orDie);
      return null;
    }
  )
);
const drainDeletedUserVerifications = FunctionImpl.make(
  databaseSchema,
  spec,
  "drainDeletedUserVerifications",
  Effect.fn("auth.deletion.verification.drainDeletedUserVerifications")(
    function* (args) {
      const ctx = yield* ActionCtxService;
      const runMutation = yield* MutationRunner.MutationRunner;
      const runQuery = yield* QueryRunner.QueryRunner;
      yield* drainDeletedUserVerificationsProgram({
        deletePage: (cursor) =>
          tryUserCleanup(() =>
            ctx.runMutation(
              components.betterAuth.deletion.deleteUserVerificationPage,
              {
                authId: args.authId,
                cursor,
              }
            )
          ),
        loadCursor: runQuery(
          refs.internal.auth.deletion.verification
            .loadDeletedUserVerificationCursor,
          {
            userId: args.userId,
          }
        ).pipe(
          Effect.mapError(toUserCleanupError),
          Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
        ),
        saveCursor: (cursor) =>
          runMutation(
            refs.internal.auth.deletion.verification
              .saveDeletedUserVerificationCursor,
            {
              cursor,
              userId: args.userId,
            }
          ).pipe(
            Effect.mapError(toUserCleanupError),
            Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
          ),
      });
      return null;
    }
  )
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(loadDeletedUserVerificationCursor),
  Layer.provide(saveDeletedUserVerificationCursor),
  Layer.provide(drainDeletedUserVerifications),
  GroupImpl.finalize
);
