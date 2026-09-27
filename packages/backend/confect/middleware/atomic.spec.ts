import { MiddlewareSpec } from "@confect/core";

/** Runs table invariants in the same transaction as each application mutation. */
export default class Atomic extends MiddlewareSpec.MiddlewareSpec<Atomic>()(
  "Atomic",
  { functionTypes: { query: false, mutation: true, action: false } }
) {}
