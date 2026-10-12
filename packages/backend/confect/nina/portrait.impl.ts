import { FunctionImpl, GroupImpl } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import { claimPortrait } from "@repo/backend/confect/nina/portrait/claim";
import { savePortrait } from "@repo/backend/confect/nina/portrait/save";
import spec from "@repo/backend/confect/nina/portrait.spec";
import { Effect, Layer } from "effect";

/** Claims the portrait build that is due, and reads what it works from. */
const claim = FunctionImpl.make(
  schema,
  spec,
  "claim",
  Effect.fn("nina.portrait.claimBuild")(function* ({ userId }) {
    return yield* claimPortrait(userId);
  })
);

/** Stores what a portrait build wrote, unless something changed meanwhile. */
const save = FunctionImpl.make(
  schema,
  spec,
  "save",
  Effect.fn("nina.portrait.save")(function* (args) {
    return yield* savePortrait(args);
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(claim),
  Layer.provide(save),
  GroupImpl.finalize
);
