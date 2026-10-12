import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { NinaUpkeepCall } from "@repo/backend/confect/nina/contract/usage";
import {
  NinaMemoryNote,
  NinaMemorySeen,
} from "@repo/backend/confect/nina/memory.spec";
import {
  NinaPortraitText,
  PORTRAIT_MEMORY_LIMIT,
} from "@repo/backend/confect/nina/portrait/schema";
import { Schema } from "effect";

/**
 * What a build reads before the model does. `memories` are the lasting
 * memories confirmed after `through`, the oldest first, at most
 * `PORTRAIT_MEMORY_LIMIT`, and `portrait` is the text as it stands. `reached`
 * is the newest confirmation time among the memories read, situations
 * included, or `through` when none is newer. `more` is whether memories remain
 * after the ones read. It is nothing when no build is due: no request is
 * waiting or its quiet is not over, memory is paused, or the account is going.
 */
const NinaPortraitClaim = Schema.NullOr(
  Schema.Struct({
    memories: Schema.mutable(Schema.Array(NinaMemoryNote)).check(
      Schema.isMaxLength(PORTRAIT_MEMORY_LIMIT)
    ),
    more: Schema.Boolean,
    portrait: Schema.optionalKey(NinaPortraitText),
    reached: Schema.Finite,
    through: Schema.Finite,
  })
);

export default GroupSpec.make()
  // Claims the build that is due and reads what it works from: the portrait as
  // it stands and the memories it has not read. A mutation, because claiming
  // moves the time of the request, so that only one of the builds scheduled
  // for a learner goes on.
  .addFunction(
    FunctionSpec.internalMutation({
      name: "claim",
      args: () => ({ userId: Id("users") }),
      returns: () => NinaPortraitClaim,
    })
  )
  // Stores what a build wrote. `expected` is the `through` the claim read and
  // `memories` are the ones it fed to the model. Nothing is written, and the
  // answer is false, when the portrait changed meanwhile, or when the learner
  // paused memory, deleted or rewrote one of those memories, or deleted them
  // all. A missing `text` keeps the current text, and an empty one removes it.
  // `more` is the claim's: when memories remain after the ones the build read,
  // storing them asks for the next build. `usage` is the tokens of the model
  // call the build made, if it made one, and they count whether or not the text
  // is stored.
  .addFunction(
    FunctionSpec.internalMutation({
      name: "save",
      args: () => ({
        expected: Schema.Finite,
        memories: Schema.mutable(Schema.Array(NinaMemorySeen)).check(
          Schema.isMaxLength(PORTRAIT_MEMORY_LIMIT)
        ),
        more: Schema.Boolean,
        reached: Schema.Finite,
        text: Schema.optionalKey(NinaPortraitText),
        usage: Schema.optionalKey(NinaUpkeepCall),
        userId: Id("users"),
      }),
      returns: () => Schema.Boolean,
    })
  );
