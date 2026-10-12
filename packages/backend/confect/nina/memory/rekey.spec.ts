import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

/**
 * What one page of the temporary re-keying did: how many memories it looked
 * at, how many of those it gave new keys, and where the next page starts.
 */
const RekeyPage = Schema.Struct({
  checked: Schema.Int,
  cursor: Schema.String,
  done: Schema.Boolean,
  rekeyed: Schema.Int,
});

export default GroupSpec.make().addFunction(
  // Temporary (ADR 0022): gives the memories that still hold word keys of an
  // older version of the index their keys of the current version, one page of
  // memories a call, from the cursor of the page before. See `rekey.impl.ts`.
  FunctionSpec.internalMutation({
    name: "page",
    args: () => ({ cursor: Schema.optionalKey(Schema.String) }),
    returns: () => RekeyPage,
  })
);
