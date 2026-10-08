import { FunctionImpl, GroupImpl } from "@confect/server";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  ActionCtx as ActionCtxService,
  DatabaseReader,
  DatabaseWriter,
  MutationRunner,
  QueryRunner,
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
      const database = yield* DatabaseReader;
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
      const database = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
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
      const { runMutation } = yield* MutationRunner;
      const { runQuery } = yield* QueryRunner;
      yield* drainDeletedUserVerificationsProgram(
        (cursor) =>
          tryUserCleanup(() =>
            ctx.runMutation(
              components.betterAuth.deletion.deleteUserVerificationPage,
              {
                authId: args.authId,
                cursor,
              }
            )
          ),
        runQuery(
          refs.internal.auth.deletion.verification
            .loadDeletedUserVerificationCursor,
          {
            userId: args.userId,
          }
        ).pipe(
          Effect.mapError(toUserCleanupError),
          Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
        ),
        (cursor) =>
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
          )
      );
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
