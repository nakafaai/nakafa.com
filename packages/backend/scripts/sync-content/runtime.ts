import { execSync } from "node:child_process";
import * as fs from "node:fs";
import { glob } from "glob";
import { CONTENTS_DIR, getBackendEnvFilePath, getSyncStateFile } from "./paths";
import { SyncStateSchema } from "./schemas";
import type { SyncState } from "./types";

const CONTENTS_PATH_PREFIX = "packages/contents/";

export const loadEnvFile = (): void => {
  const envPath = getBackendEnvFilePath();
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("=");
    if (key && value && !process.env[key]) {
      process.env[key] = value;
    }
  }
};

export const loadSyncState = (isProd: boolean): SyncState | null => {
  try {
    const stateFile = getSyncStateFile(isProd);
    if (!fs.existsSync(stateFile)) {
      return null;
    }

    const content = fs.readFileSync(stateFile, "utf8");
    const parsed = SyncStateSchema.safeParse(JSON.parse(content));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

export const saveSyncState = (state: SyncState, isProd: boolean): void => {
  const stateFile = getSyncStateFile(isProd);
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
};

export const clearSyncState = (isProd: boolean): void => {
  const stateFile = getSyncStateFile(isProd);
  if (fs.existsSync(stateFile)) {
    fs.unlinkSync(stateFile);
  }
};

export const getCurrentGitCommit = (): string => {
  try {
    return execSync("git rev-parse HEAD", {
      cwd: CONTENTS_DIR,
      encoding: "utf8",
    }).trim();
  } catch {
    return "";
  }
};

/** Returns committed, working-tree, staged, and untracked content changes. */
export const getChangedFilesSince = (commit: string): Set<string> => {
  const changedFiles = new Set<string>();

  addGitOutputFiles(changedFiles, `git diff --name-only ${commit} HEAD -- .`);
  addGitOutputFiles(changedFiles, "git diff --name-only -- .");
  addGitOutputFiles(changedFiles, "git diff --name-only --cached -- .");
  addGitOutputFiles(
    changedFiles,
    "git ls-files --others --exclude-standard -- ."
  );

  return changedFiles;
};

/** Adds content-root relative files from one git command into a shared set. */
function addGitOutputFiles(changedFiles: Set<string>, command: string) {
  try {
    const output = execSync(command, {
      cwd: CONTENTS_DIR,
      encoding: "utf8",
    });

    for (const file of getOutputFiles(output)) {
      changedFiles.add(getContentFilePath(file));
    }
  } catch {
    return;
  }
}

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

export const globFiles = (pattern: string): Promise<string[]> =>
  glob(pattern, { cwd: CONTENTS_DIR, absolute: true });
