import { Array as Arr, Schema } from "effect";

/** What the school's setup still needs from its owner or admin, in the order the setup tile lists them. */
const SETUP_STEPS = ["class", "teacher", "students", "invites"] as const;

/** One step of the school's setup. */
export type SetupStep = (typeof SETUP_STEPS)[number];

/**
 * The school's setup as the home reads it: the setup read, and whether the viewer's units hold an active one.
 * The setup read's own fields are the first three.
 */
const SetupState = Schema.Struct({
  hasActiveUnit: Schema.Boolean,
  hasPendingInvite: Schema.Boolean,
  hasStudent: Schema.Boolean,
  hasTeacher: Schema.Boolean,
});

/** The school's setup as the home reads it. */
export type SetupState = typeof SetupState.Type;

/** Whether each step is still missing from the school's setup. */
const MISSING: Record<SetupStep, (state: SetupState) => boolean> = {
  class: (state) => !state.hasActiveUnit,
  invites: (state) => state.hasPendingInvite,
  students: (state) => !state.hasStudent,
  teacher: (state) => !state.hasTeacher,
};

/** The steps that the school still lacks, in the order the setup tile lists them. A complete school has none. */
export const missingSteps = (state: SetupState) =>
  Arr.filter(SETUP_STEPS, (step) => MISSING[step](state));
