import { FunctionSpec, GroupSpec } from "@confect/core";
import type {
  cleanupDeletedUserAnalytics,
  cleanupDeletedUserAuth,
  cleanupDeletedUserCustomer,
  cleanupDeletedUserData,
} from "@repo/backend/confect/customers/deletion/cleanup";
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
    FunctionSpec.convexInternalMutation<typeof cleanupDeletedUserCustomer>()(
      "cleanupDeletedUserCustomer"
    )
  )
  .addFunction(
    FunctionSpec.convexInternalMutation<typeof cleanupDeletedUserData>()(
      "cleanupDeletedUserData"
    )
  );
