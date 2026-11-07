import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { Effect, FileSystem, Option, Schema, Stream } from "effect";
import { ChildProcess } from "effect/process";

/**
 * The part of a backend's `convex.json` that names the Node major of its "use node"
 * actions. Convex supports only some majors there, so the machine's own `node`,
 * which may be newer, cannot run them.
 * @see https://docs.convex.dev/functions/runtimes
 */
const ConvexNodeConfig = Schema.fromJsonString(
  Schema.Struct({
    node: Schema.Struct({
      nodeVersion: Schema.String.check(Schema.isPattern(/^\d+$/u)),
    }),
  })
);

/** The Node major that a backend's `convex.json` names for its "use node" actions. */
export const readConvexNodeMajor = Effect.fn(
  "contentAcceptance.readConvexNodeMajor"
)(function* (backend: string) {
  const fs = yield* FileSystem.FileSystem;
  const config = yield* fs
    .readFileString(`${backend}/convex.json`)
    .pipe(Effect.flatMap(Schema.decodeEffect(ConvexNodeConfig)));
  return config.node.nodeVersion;
});

/** The prefix that Homebrew installed a formula under, or none when Homebrew cannot name one. */
const brewPrefix = Effect.fn("contentAcceptance.brewPrefix")(
  function* (formula: string) {
    const child = yield* ChildProcess.make("brew", ["--prefix", formula], {
      extendEnv: true,
      stderr: "ignore",
      stdin: "ignore",
    });
    const [text, code] = yield* Effect.all(
      [child.stdout.pipe(Stream.decodeText(), Stream.mkString), child.exitCode],
      { concurrency: "unbounded" }
    );
    const prefix = text.trim();
    return code === 0 && prefix !== ""
      ? Option.some(prefix)
      : Option.none<string>();
  },
  Effect.scoped,
  Effect.catchTag("PlatformError", () => Effect.succeedNone)
);

/**
 * The `bin` directory of the Node that a backend's "use node" actions need. The
 * local Convex backend runs those actions with the first `node` on its PATH, and
 * with any other major it never finishes starting
 * (`DeploymentNotConfiguredForNodeActions`), so the runtime puts this directory
 * first. A machine without that Node fails at once with the command that installs
 * it, instead of a start that waits forever.
 */
export const resolveConvexNodeBin = Effect.fn(
  "contentAcceptance.resolveConvexNodeBin"
)(function* (backend: string) {
  const fs = yield* FileSystem.FileSystem;
  const major = yield* readConvexNodeMajor(backend);
  const formula = `node@${major}`;
  const missing = acceptanceRuntimeError(
    `Convex runs "use node" actions on Node ${major} (convex.json), and no Node ${major} is installed: run \`brew install ${formula}\`.`
  );
  const prefix = yield* brewPrefix(formula);
  if (Option.isNone(prefix)) {
    return yield* missing;
  }
  const bin = `${prefix.value}/bin`;
  if (!(yield* fs.exists(`${bin}/node`))) {
    return yield* missing;
  }
  return bin;
});
