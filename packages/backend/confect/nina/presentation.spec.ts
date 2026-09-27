import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

export const DEFAULT_TITLE = "New Chat";
export const MAX_TITLE_LENGTH = 80;

export const NinaSuggestions = Schema.mutable(
  Schema.Array(
    Schema.Trim.check(Schema.isMinLength(1), Schema.isMaxLength(300))
  )
).check(Schema.isLengthBetween(1, 5));
export const NinaTitle = Schema.Trim.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(MAX_TITLE_LENGTH)
);

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

export const NINA_MESSAGES_PAGE_SIZE = 50;
