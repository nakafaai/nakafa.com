import { FunctionSpec, GroupSpec } from "@confect/core";
import { UserCleanupErrorWire } from "@repo/backend/confect/auth/cleanup/spec";
import { accountDeletionPreparationVersionValidator } from "@repo/backend/confect/auth/deletion/spec";
import { Schema } from "effect";
export const sweepAccountDeletionRecoveryArgsValidator = Schema.Struct({});
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "sweepAccountDeletionRecovery",
      args: () => sweepAccountDeletionRecoveryArgsValidator.fields,
      returns: () => Schema.Null,
      error: () => UserCleanupErrorWire,
    })
  )
  .addFunction(
    FunctionSpec.internalAction({
      name: "recoverAccountDeletion",
      args: () => ({
        authId: Schema.String,
        expectedPreparation: accountDeletionPreparationVersionValidator,
      }),
      returns: () => Schema.Null,
      error: () => UserCleanupErrorWire,
    })
  );
