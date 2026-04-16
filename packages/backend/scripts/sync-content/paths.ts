import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleFileName = fileURLToPath(import.meta.url);
const moduleDir = path.dirname(moduleFileName);

export const SYNC_CONTENT_DIR = moduleDir;
export const SCRIPTS_DIR = path.resolve(moduleDir, "..");
export const BACKEND_DIR = path.resolve(SCRIPTS_DIR, "..");
export const CONTENTS_DIR = path.resolve(SCRIPTS_DIR, "../../contents");

export const getSyncStateFile = (isProd: boolean): string => {
  const filename = isProd ? ".sync-state.prod.json" : ".sync-state.json";
  return path.resolve(BACKEND_DIR, filename);
};

export const getBackendEnvFilePath = (): string =>
  path.resolve(BACKEND_DIR, ".env.local");
