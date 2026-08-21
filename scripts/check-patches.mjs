import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
  "repos",
]);

/** Collects application-owned patch files without entering generated source. */
function readApplicationPatchFiles(root) {
  const patchFiles = [];
  const pending = [root];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) {
      continue;
    }

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(entryPath);
      } else if (entry.name.endsWith(".patch")) {
        patchFiles.push(path.relative(root, entryPath));
      }
    }
  }

  return patchFiles.sort();
}

const repositoryRoot = process.cwd();
const patchFiles = readApplicationPatchFiles(repositoryRoot);
const workspace = readFileSync(
  path.join(repositoryRoot, "pnpm-workspace.yaml"),
  "utf8"
);
const failures = [];

if (patchFiles.length > 0) {
  failures.push(
    `Application dependency patches require explicit review: ${patchFiles.join(", ")}.`
  );
}
if (/^patchedDependencies:/mu.test(workspace)) {
  failures.push("pnpm-workspace.yaml must not register dependency patches.");
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("No application dependency patches are registered.\n");
}
