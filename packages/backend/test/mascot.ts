import { MascotCode } from "@repo/mascot/code";
import { Schema } from "effect";

/** The stored code of the animal a fixture account has when no test reads it. */
export const MASCOT_CODE = "cat.0.243e66.right.open";

/** The same animal decoded, for fixtures that insert through a Confect writer. */
export const MASCOT = Schema.decodeSync(MascotCode)(MASCOT_CODE);
