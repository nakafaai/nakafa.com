import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  AccountNotFound,
  NotOperator,
} from "@repo/backend/confect/operators/errors";
import { OperatorView } from "@repo/backend/confect/operators/schema";

/**
 * Nakafa staff grant and revoke operator access. Both are internal, so only the
 * deployment's key runs them, with `convex run`.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "grant",
      args: () => ({ userId: Id("users") }),
      returns: () => OperatorView,
      error: () => AccountNotFound,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "revoke",
      args: () => ({ userId: Id("users") }),
      returns: () => OperatorView,
      error: () => NotOperator,
    })
  );
