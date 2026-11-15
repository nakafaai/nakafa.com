import { NodeServices } from "@effect/platform-node";
import {
  Array as Arr,
  Effect,
  FileSystem,
  Layer,
  Option,
  Record as Rec,
  Ref,
  Schema,
} from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

/** What a scripted command prints and how it exits, the files it writes by absolute path, and whether it cannot start at all. */
const Answer = Schema.Struct({
  stdout: Schema.optionalKey(Schema.String),
  stderr: Schema.optionalKey(Schema.String),
  code: Schema.optionalKey(Schema.Int),
  files: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
  missing: Schema.optionalKey(Schema.Boolean),
});
export type Answer = typeof Answer.Type;

/**
 * A spawner for tests where every command that `script` answers prints that
 * answer and exits with its code, and every other command runs for real. Each
 * scripted command line is recorded in `calls`.
 */
export function scriptedShell(
  script: (command: string, args: readonly string[]) => Answer | undefined,
  calls: Ref.Ref<readonly string[]>
) {
  return Layer.effect(
    ChildProcessSpawner.ChildProcessSpawner,
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const files = yield* FileSystem.FileSystem;
      // A piped command, or one the script leaves unanswered, runs for real.
      return ChildProcessSpawner.make((command) =>
        Option.match(
          Option.flatMap(
            Option.liftPredicate(command, ChildProcess.isStandardCommand),
            (standard) => {
              const args = Arr.map(standard.args, String);
              return Option.map(
                Option.fromNullishOr(script(standard.command, args)),
                (answer) => ({
                  answer,
                  line: Arr.join([standard.command, ...args], " "),
                })
              );
            }
          ),
          {
            onNone: () => spawner.spawn(command),
            onSome: ({ answer, line }) =>
              Effect.gen(function* () {
                yield* Ref.update(calls, Arr.append(line));
                for (const [path, text] of Rec.toEntries(answer.files ?? {})) {
                  yield* files.makeDirectory(
                    path.slice(0, path.lastIndexOf("/")),
                    { recursive: true }
                  );
                  yield* files.writeFileString(path, text);
                }
                if (answer.missing === true) {
                  return yield* spawner.spawn(
                    ChildProcess.make("/nonexistent/scripted/command")
                  );
                }
                return yield* spawner.spawn(
                  ChildProcess.make("sh", [
                    "-c",
                    'printf "%s" "$1"; printf "%s" "$2" >&2; exit "$3"',
                    "sh",
                    answer.stdout ?? "",
                    answer.stderr ?? "",
                    String(answer.code ?? 0),
                  ])
                );
              }),
          }
        )
      );
    })
  ).pipe(Layer.provide(NodeServices.layer));
}
