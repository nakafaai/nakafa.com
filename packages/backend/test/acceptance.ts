import { tmpdir } from "node:os";
import { Effect, FileSystem, MutableList } from "effect";

/** A temporary backend checkout holding the Convex files a local runtime reads. */
export const fixture = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped({
    directory: tmpdir(),
    prefix: "acceptance-local-test-",
  });
  const root = yield* fs.realPath(directory);
  yield* fs.makeDirectory(`${root}/packages/backend`, { recursive: true });
  yield* fs.writeFileString(
    `${root}/packages/backend/convex.json`,
    '{"node":{"nodeVersion":"24"}}'
  );
  yield* fs.writeFileString(
    `${root}/packages/backend/.env.local`,
    "CONVEX_DEPLOYMENT=developer-owned"
  );
  yield* fs.makeDirectory(`${root}/packages/backend/.convex`);
  return { fs, root };
});

/**
 * Answers the Convex commands of an anonymous runtime. `init` writes `source` as
 * the environment and a loopback configuration; every command records the
 * temporary root it ran in while that root still exists.
 */
export function anonymousConvexCommand(
  source: string,
  temporaryRoots: MutableList.MutableList<string>
) {
  return (spec: {
    args: readonly string[];
    cwd: string;
    env: Readonly<Record<string, string | undefined>>;
  }) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = spec.env.TMPDIR;
      if (root !== undefined && (yield* fs.exists(root))) {
        MutableList.append(temporaryRoots, root);
      }
      if (spec.args[1] !== "init") {
        return;
      }
      yield* fs.writeFileString(`${spec.cwd}/.env.local`, source);
      yield* fs.makeDirectory(`${spec.cwd}/.convex/local/default`, {
        recursive: true,
      });
      yield* fs.writeFileString(
        `${spec.cwd}/.convex/local/default/config.json`,
        '{"ports":{"cloud":43120,"site":43121}}'
      );
    });
}
