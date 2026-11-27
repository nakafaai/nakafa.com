import { Schema } from "effect";

/** The element a shell model draws: its atomic number and symbol. */
const ShellModelSampleSchema = Schema.Struct({
  atomicNumber: Schema.Finite,
  symbol: Schema.String,
});
export type ShellModelSample = typeof ShellModelSampleSchema.Type;

/** One shell of the model: its letter and how many electrons it holds. */
const ShellModelShellSchema = Schema.Struct({
  electronCount: Schema.Finite,
  key: Schema.String,
});
type ShellModelShell = typeof ShellModelShellSchema.Type;

export type ShellModelShells = readonly ShellModelShell[];
