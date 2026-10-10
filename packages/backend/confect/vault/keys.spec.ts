import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

/**
 * The second step of a root key rotation. First put the new root key in front
 * of the old one in `VAULT_ROOT_KEYS`. Then run `rewrap` until it returns zero
 * (`convex run vault/keys:rewrap`): each call moves one page of learner keys to
 * the new root key. Then remove the old root key from the environment and
 * destroy every copy of it. Old backups stay readable for anyone who still
 * holds a copy.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "rewrap",
    args: () => ({}),
    returns: () => Schema.Finite,
  })
);
