import { FunctionSpec, GroupSpec } from "@confect/core";
import { NinaTitle } from "@repo/backend/client/nina/presentation";
import { Id } from "@repo/backend/confect/_generated/id";
import { NinaSuggestions } from "@repo/backend/confect/nina/contract/suggestions";
import { Schema } from "effect";

export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "save",
    args: () => ({
      turnId: Id("ninaTurns"),
      suggestions: Schema.optionalKey(NinaSuggestions),
      title: Schema.optionalKey(NinaTitle),
    }),
    returns: () => Schema.Null,
  })
);
