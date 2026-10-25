import { FunctionSpec, GroupSpec } from "@confect/core";
import type {
  cleanupDeletedUserAnalytics,
  cleanupDeletedUserAuth,
  cleanupDeletedUserBilling,
  cleanupDeletedUserData,
} from "@repo/backend/confect/auth/deletion/cleanup";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.convexInternalMutation<typeof cleanupDeletedUserAuth>()(
      "cleanupDeletedUserAuth"
    )
  )
  .addFunction(
    FunctionSpec.convexInternalMutation<typeof cleanupDeletedUserAnalytics>()(
      "cleanupDeletedUserAnalytics"
    )
  )
  .addFunction(
    FunctionSpec.convexInternalMutation<typeof cleanupDeletedUserBilling>()(
      "cleanupDeletedUserBilling"
    )
  )
  .addFunction(
    FunctionSpec.convexInternalMutation<typeof cleanupDeletedUserData>()(
      "cleanupDeletedUserData"
    )
  );
