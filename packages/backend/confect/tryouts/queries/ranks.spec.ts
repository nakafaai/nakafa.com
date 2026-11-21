import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import Session from "@repo/backend/confect/middleware/session.spec";
import {
  TryoutRouteErrorWire,
  tryoutSetIdentityValidator,
} from "@repo/backend/confect/tryouts/route";
import { TryoutRuntimeErrorWire } from "@repo/backend/confect/tryouts/runtime/error";
import { MascotCode } from "@repo/mascot/code";
import { Schema } from "effect";

/** One learner on a set's board: their best, their first name and mascot, its score and place, and whether it is the viewer. */
const setLeaderValidator = Schema.Struct({
  id: IdSchema("tryoutSetBests"),
  mascot: MascotCode,
  name: Schema.String,
  own: Schema.Boolean,
  place: Schema.Int,
  score: Schema.Finite,
});

/**
 * One set's leaderboard: the first learners it ranks, the viewer's own row, which stands under the first ones
 * when it is not among them, and the place the attempt the page shows takes among `count` learners.
 */
const setBoardValidator = Schema.Struct({
  count: Schema.Int,
  leaders: Schema.Array(setLeaderValidator),
  own: Schema.NullOr(setLeaderValidator),
  standing: Schema.NullOr(Schema.Int),
});

/** The leaderboards of try-out sets, each learner ranked by their best score on the set. */
export default GroupSpec.make().addFunction(
  FunctionSpec.publicQuery({
    name: "bySet",
    args: () => ({
      ...tryoutSetIdentityValidator.fields,
      /** The attempt the page's address names (`?attemptId`), whose place the board answers; without one, the viewer's latest. */
      attemptId: Schema.optionalKey(Schema.String),
    }),
    returns: () => setBoardValidator,
    error: () => Schema.Union([TryoutRouteErrorWire, TryoutRuntimeErrorWire]),
  }).middleware(Session)
);
