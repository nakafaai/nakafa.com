import { Caller, Change, Pick, Target } from "@repo/backend/test/gate/world";
import { Schema } from "effect";

/** A refusal every write meets on the same target, with the changes that cause it. */
const Refusal = Schema.Struct({
  caller: Caller,
  case: Schema.String,
  changes: Schema.Array(Change),
  reason: Schema.Literals([
    "Missing",
    "AttemptClosed",
    "SectionClosed",
    "Expired",
  ]),
  target: Target,
});

/** The targets and states that every kind of write refuses alike. */
export const refusals: readonly (typeof Refusal.Type)[] = [
  {
    caller: "learner",
    case: "a target that does not exist",
    changes: [],
    reason: "Missing",
    target: "missing",
  },
  {
    caller: "other",
    case: "another learner's target",
    changes: [],
    reason: "Missing",
    target: "running",
  },
  {
    caller: "other",
    case: "another learner's target whose section rows are corrupt",
    changes: ["duplicate-section"],
    reason: "Missing",
    target: "running",
  },
  {
    caller: "learner",
    case: "an attempt that ended, before its deadline is checked",
    changes: ["close-attempt", "expire-attempt"],
    reason: "AttemptClosed",
    target: "running",
  },
  {
    caller: "learner",
    case: "an attempt that ran out of time is closed, whatever its deadline says",
    changes: ["expire-attempt-status"],
    reason: "AttemptClosed",
    target: "running",
  },
  {
    caller: "learner",
    case: "a section that ended",
    changes: ["close-section"],
    reason: "SectionClosed",
    target: "running",
  },
  {
    caller: "learner",
    case: "a section not yet started",
    changes: [],
    reason: "SectionClosed",
    target: "unstarted",
  },
  {
    caller: "learner",
    case: "a passed attempt deadline",
    changes: ["expire-attempt"],
    reason: "Expired",
    target: "running",
  },
];

/** A selection the question rejects, and why. */
const Rejection = Schema.Struct({
  pick: Pick,
  reason: Schema.Literals(["selection", "kind"]),
});

/** The selections that do not belong to their question. */
export const rejections: readonly (typeof Rejection.Type)[] = [
  { pick: "invalid", reason: "selection" },
  { pick: "kind", reason: "kind" },
];

/** A change that ends an answer's right to be written, and the refusal it causes. */
const Ending = Schema.Struct({
  change: Change,
  reason: Schema.Literals(["AttemptClosed", "SectionClosed", "Expired"]),
});

/** The states that refuse an answer before its version is checked. */
export const endings: readonly (typeof Ending.Type)[] = [
  { change: "close-attempt", reason: "AttemptClosed" },
  { change: "close-section", reason: "SectionClosed" },
  { change: "expire-section", reason: "Expired" },
];
