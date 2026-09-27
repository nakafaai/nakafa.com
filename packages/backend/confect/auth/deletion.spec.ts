import { FunctionSpec, GroupSpec } from "@confect/core";
import { UserCleanupErrorWire } from "@repo/backend/confect/auth/cleanup/spec";
import {
  AccountDeletionCancellationUnprovenErrorWire,
  accountDeletionAttemptStatusValidator,
  accountDeletionCancellationOutcomeValidator,
  accountDeletionPreparationOutcomeValidator,
  accountDeletionPreparationVersionValidator,
} from "@repo/backend/confect/auth/deletion/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import { Schema } from "effect";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "claimAccountDeletion",
      args: () => ({
        attemptId: Schema.String,
        authId: Schema.String,
      }),
      returns: () => accountDeletionPreparationOutcomeValidator,
      error: () => UserCleanupErrorWire,
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "continueAccountDeletionCommit",
      args: () => ({
        authId: Schema.String,
        expectedPreparation: accountDeletionPreparationVersionValidator,
      }),
      returns: () => Schema.Boolean,
      error: () => UserCleanupErrorWire,
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "prepareCurrentAccountDeletion",
      args: () => ({
        attemptId: Schema.String,
      }),
      returns: () => accountDeletionPreparationOutcomeValidator,
      error: () => UserCleanupErrorWire,
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "cancelAccountDeletion",
      args: () => ({
        authId: Schema.String,
        expectedPreparation: accountDeletionPreparationVersionValidator,
      }),
      returns: () => Schema.Boolean,
      error: () => UserCleanupErrorWire,
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "cancelAccountDeletionAttempt",
      args: () => ({
        attemptId: Schema.String,
      }),
      returns: () => accountDeletionCancellationOutcomeValidator,
      error: () =>
        Schema.Union([
          UserCleanupErrorWire,
          AccountDeletionCancellationUnprovenErrorWire,
        ]),
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getAccountDeletionAttemptStatus",
      args: () => ({
        attemptId: Schema.String,
      }),
      returns: () => accountDeletionAttemptStatusValidator,
      error: () => UserCleanupErrorWire,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "sweepAccountDeletionRetention",
      args: () => ({}),
      returns: () => Schema.Null,
      error: () => UserCleanupErrorWire,
    }).middleware(Atomic)
  );
