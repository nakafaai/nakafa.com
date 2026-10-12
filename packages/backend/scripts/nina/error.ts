import { Schema } from "effect";

/**
 * Expected failure of the release gate: the deployment refused the gate, a
 * command did not answer as the gate needs, or the turn never settled. The
 * message names the step and never holds message text.
 */
export class NinaGateError extends Schema.TaggedError<NinaGateError>()(
  "NinaGateError",
  { message: Schema.String }
) {}

export const gateError = (message: string) => new NinaGateError({ message });
