import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleFileName = fileURLToPath(import.meta.url);
const moduleDir = path.dirname(moduleFileName);

/** Absolute path to the folder-owned sync-content script modules. */
export const SYNC_CONTENT_DIR = path.resolve(moduleDir, "..");
/** Absolute path to the backend scripts directory that owns CLI entrypoints. */
export const SCRIPTS_DIR = path.resolve(SYNC_CONTENT_DIR, "..");
/** Absolute path to the backend package root, independent of process cwd. */
export const BACKEND_DIR = path.resolve(SCRIPTS_DIR, "..");
/** Absolute path to the contents package used by source-file globbing. */
export const CONTENTS_DIR = path.resolve(BACKEND_DIR, "../contents");

/** Returns the dev or prod sync-state file owned by the backend package root. */
export const getSyncStateFile = (isProd: boolean): string => {
  const filename = isProd ? ".sync-state.prod.json" : ".sync-state.json";
  return path.resolve(BACKEND_DIR, filename);
};

/** Returns the backend-local env file read by the sync-content CLI. */
export const getBackendEnvFilePath = (): string =>
  path.resolve(BACKEND_DIR, ".env.local");
