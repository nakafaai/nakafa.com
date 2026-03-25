import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CONTENTS_SENTINELS = ["_lib", "articles", "exercises", "subject"];

const isContentsDirectory = (directory: string) => {
  return CONTENTS_SENTINELS.every((entry) => {
    return fs.existsSync(path.join(directory, entry));
  });
};

export const resolveContentsDir = (metaUrl: string) => {
  const currentWorkingDirectory = process.cwd();
  const fallbackDirectory = path.resolve(
    path.dirname(fileURLToPath(metaUrl)),
    ".."
  );

  const candidates = [
    currentWorkingDirectory,
    path.resolve(currentWorkingDirectory, "packages/contents"),
    path.resolve(currentWorkingDirectory, "../packages/contents"),
    path.resolve(currentWorkingDirectory, "../../packages/contents"),
    fallbackDirectory,
  ];

  for (const candidate of new Set(candidates)) {
    if (isContentsDirectory(candidate)) {
      return candidate;
    }
  }

  return fallbackDirectory;
};
