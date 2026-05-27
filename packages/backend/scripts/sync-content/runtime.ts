import { execSync } from "node:child_process";
import * as fs from "node:fs";
import { parseEnv } from "node:util";
import {
  CONTENTS_DIR,
  getBackendEnvFilePath,
  getSyncStateFile,
} from "@repo/backend/scripts/sync-content/paths";
import { SyncStateSchema } from "@repo/backend/scripts/sync-content/schemas";
import type { SyncState } from "@repo/backend/scripts/sync-content/types";
import { ConfigProvider, Effect, Schema } from "effect";
import { glob } from "glob";

const CONTENTS_PATH_PREFIX = "packages/contents/";

class RuntimeFileError extends Schema.TaggedError<RuntimeFileError>()(
  "RuntimeFileError",
  {
    message: Schema.String,
  }
) {}

const getUnknownMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** Builds an Effect config provider from backend `.env.local` plus the shell. */
export const loadEnvProvider = Effect.fn("scripts.loadEnvProvider")(function* (
  env = ConfigProvider.fromEnv()
) {
  const map = yield* readEnvFileMap;

  if (map.size === 0) {
    return env;
  }

  return ConfigProvider.orElse(env, () => ConfigProvider.fromMap(map));
});

const readEnvFileMap = Effect.gen(function* () {
  const envPath = getBackendEnvFilePath();

  if (!fs.existsSync(envPath)) {
    return new Map<string, string>();
  }

  const content = yield* Effect.try({
    try: () => fs.readFileSync(envPath, "utf8"),
    catch: (error) =>
      new RuntimeFileError({ message: getUnknownMessage(error) }),
  });
  return yield* Effect.try({
    try: () => {
      const values = new Map<string, string>();

      for (const [key, value] of Object.entries(parseEnv(content))) {
        if (value !== undefined) {
          values.set(key, value);
        }
      }

      return values;
    },
    catch: (error) =>
      new RuntimeFileError({ message: getUnknownMessage(error) }),
  });
});

/** Reads the last successful content-sync state when it exists. */
export const loadSyncState = Effect.fn("scripts.loadSyncState")(function* (
  isProd: boolean
) {
  const state = yield* Effect.either(
    Effect.gen(function* () {
      const stateFile = getSyncStateFile(isProd);

      if (!fs.existsSync(stateFile)) {
        return null;
      }

      const content = yield* Effect.try({
        try: () => fs.readFileSync(stateFile, "utf8"),
        catch: (error) =>
          new RuntimeFileError({ message: getUnknownMessage(error) }),
      });
      const json = yield* Effect.try({
        try: () => JSON.parse(content),
        catch: (error) =>
          new RuntimeFileError({ message: getUnknownMessage(error) }),
      });
      const parsed = Schema.decodeUnknownOption(SyncStateSchema)(json);

      return parsed._tag === "Some" ? parsed.value : null;
    })
  );

  if (state._tag === "Left") {
    return null;
  }

  return state.right;
});

/** Persists the current content-sync state for incremental sync. */
export const saveSyncState = Effect.fn("scripts.saveSyncState")(function* (
  state: SyncState,
  isProd: boolean
) {
  const stateFile = getSyncStateFile(isProd);

  yield* Effect.try({
    try: () => fs.writeFileSync(stateFile, JSON.stringify(state, null, 2)),
    catch: (error) =>
      new RuntimeFileError({ message: getUnknownMessage(error) }),
  });
});

/** Deletes the content-sync state file when it exists. */
export const clearSyncState = Effect.fn("scripts.clearSyncState")(function* (
  isProd: boolean
) {
  const stateFile = getSyncStateFile(isProd);

  if (fs.existsSync(stateFile)) {
    yield* Effect.try({
      try: () => fs.unlinkSync(stateFile),
      catch: (error) =>
        new RuntimeFileError({ message: getUnknownMessage(error) }),
    });
  }
});

/** Reads the current content repository commit, or an empty string outside git. */
export const getCurrentGitCommit = Effect.fn("scripts.getCurrentGitCommit")(
  function* () {
    const result = yield* Effect.either(
      Effect.try({
        try: () =>
          execSync("git rev-parse HEAD", {
            cwd: CONTENTS_DIR,
            encoding: "utf8",
          }).trim(),
        catch: (error) =>
          new RuntimeFileError({ message: getUnknownMessage(error) }),
      })
    );

    if (result._tag === "Left") {
      return "";
    }

    return result.right;
  }
);

/** Returns committed, working-tree, staged, and untracked content changes. */
export const getChangedFilesSince = Effect.fn("scripts.getChangedFilesSince")(
  function* (commit: string) {
    const changedFiles = new Set<string>();

    yield* addGitOutputFiles(
      changedFiles,
      `git diff --name-only ${commit} HEAD -- .`
    );
    yield* addGitOutputFiles(changedFiles, "git diff --name-only -- .");
    yield* addGitOutputFiles(
      changedFiles,
      "git diff --name-only --cached -- ."
    );
    yield* addGitOutputFiles(
      changedFiles,
      "git ls-files --others --exclude-standard -- ."
    );

    return changedFiles;
  }
);

/** Adds content-root relative files from one git command into a shared set. */
const addGitOutputFiles = Effect.fn("scripts.addGitOutputFiles")(function* (
  changedFiles: Set<string>,
  command: string
) {
  const result = yield* Effect.either(
    Effect.try({
      try: () =>
        execSync(command, {
          cwd: CONTENTS_DIR,
          encoding: "utf8",
        }),
      catch: (error) =>
        new RuntimeFileError({ message: getUnknownMessage(error) }),
    })
  );

  if (result._tag === "Left") {
    return;
  }

  for (const file of getOutputFiles(result.right)) {
    changedFiles.add(getContentFilePath(file));
  }
});

/** Converts either repo-root or content-root git paths to absolute paths. */
function getContentFilePath(file: string) {
  if (file.startsWith(CONTENTS_PATH_PREFIX)) {
    return `${CONTENTS_DIR}/${file.slice(CONTENTS_PATH_PREFIX.length)}`;
  }

  return `${CONTENTS_DIR}/${file}`;
}

/** Returns normalized file paths from one git command output. */
function getOutputFiles(output: string) {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Finds content files with glob through an Effect promise boundary. */
export const globFiles = Effect.fn("scripts.globFiles")(function* (
  pattern: string
) {
  return yield* Effect.tryPromise({
    try: () => glob(pattern, { cwd: CONTENTS_DIR, absolute: true }),
    catch: (error) =>
      new RuntimeFileError({ message: getUnknownMessage(error) }),
  });
});
