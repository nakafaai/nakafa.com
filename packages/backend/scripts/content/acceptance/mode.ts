import {
  type AcceptanceRuntimeError,
  acceptanceRuntimeError,
} from "@repo/backend/scripts/content/acceptance/error";
import {
  Array as Arr,
  Effect,
  type FileSystem,
  type Path,
  type PlatformError,
  Schema,
  type Scope,
} from "effect";
import type { SecureRandom } from "effect/crypto";
import type { HttpClient } from "effect/http";
import type { ChildProcessSpawner } from "effect/process";
import type { SocketServer } from "effect/socket";

/**
 * What a mode may fail with: its own usage refusal, a file system or child
 * process failure, a socket that the analytics stand-in could not open, or a value
 * that a schema rejects.
 */
export type AcceptanceModeError =
  | AcceptanceRuntimeError
  | PlatformError.PlatformError
  | Schema.SchemaError
  | SocketServer.SocketServerError;

/**
 * The services that every mode may use. The command line's layer provides all of
 * them except the scope, which the command line gives each mode while it runs.
 */
type AcceptanceModeServices =
  | SecureRandom.SecureRandom
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner
  | HttpClient.HttpClient
  | Scope.Scope;

/**
 * One mode of the acceptance command line: the word that selects it, the usage
 * that names its arguments, and the run that parses those arguments and performs
 * the mode from the repository root. Each command module exports its own mode, so
 * a command owns its usage, its arguments, and its test.
 */
export interface AcceptanceMode {
  /** The word that selects the mode: the first argument after the command. */
  readonly mode: string;
  /** Runs the mode with the arguments that follow its word. */
  readonly run: (
    root: string,
    args: readonly string[]
  ) => Effect.Effect<void, AcceptanceModeError, AcceptanceModeServices>;
  /** The mode and its arguments, as the usage line lists them. */
  readonly usage: string;
}

/**
 * Decodes the positional arguments of one mode with the tuple schema that names
 * them. A missing argument refuses with the usage of its mode before any operation
 * starts. An argument past the schema is ignored, as the command line has always
 * ignored one.
 */
export const decodeModeArguments = Effect.fn(
  "contentAcceptance.decodeModeArguments"
)(function* <Elements extends Schema.Tuple.Elements>(
  usage: string,
  schema: Schema.Tuple<Elements>,
  args: readonly string[]
) {
  return yield* Schema.decodeUnknownEffect(schema)(
    Arr.take(args, schema.elements.length)
  ).pipe(
    Effect.mapError(() => acceptanceRuntimeError(`Usage: acceptance ${usage}`))
  );
});
