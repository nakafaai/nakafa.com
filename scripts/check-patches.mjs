import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const REPOSITORY_ROOT = process.cwd();
const NEXT_VERSION = "16.3.0";
const NEXT_PATCH_PATH = "patches/next.patch";
const NEXT_PATCH_SHA256 =
  "69c234729b8a9eddad005442418b6c7c6f2fecc62a72fe12db60507ada0c6136";
const NEXT_UPSTREAM_FIX = "5f735c1ac56b93bc28cd3af86961c47c838fb077";
const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
  "repos",
]);

/** Collects application-owned patch files without entering generated or vendored trees. */
function readApplicationPatchFiles(directory) {
  const patchFiles = [];
  const pending = [directory];

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
        continue;
      }

      if (entry.name.endsWith(".patch")) {
        patchFiles.push(path.relative(REPOSITORY_ROOT, entryPath));
      }
    }
  }

  return patchFiles.sort();
}

/** Reads one declared dependency version from every first-party workspace. */
function readDependencyVersions(dependencyName) {
  const dependencyVersions = [];

  for (const workspaceDirectory of ["apps", "packages"]) {
    const workspaceRoot = path.join(REPOSITORY_ROOT, workspaceDirectory);

    for (const entry of readdirSync(workspaceRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      const manifestPath = path.join(workspaceRoot, entry.name, "package.json");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

      for (const dependencyGroup of [
        "dependencies",
        "devDependencies",
        "peerDependencies",
      ]) {
        const dependencyVersion = manifest[dependencyGroup]?.[dependencyName];

        if (typeof dependencyVersion === "string") {
          dependencyVersions.push({
            manifestPath: path.relative(REPOSITORY_ROOT, manifestPath),
            version: dependencyVersion,
          });
        }
      }
    }
  }

  return dependencyVersions;
}

const failures = [];
const patchFiles = readApplicationPatchFiles(REPOSITORY_ROOT);
const expectedPatchFiles = [NEXT_PATCH_PATH];

if (JSON.stringify(patchFiles) !== JSON.stringify(expectedPatchFiles)) {
  failures.push(
    `Application patches must match the reviewed allowlist. Expected: ${expectedPatchFiles.join(", ")}. Found: ${patchFiles.join(", ") || "none"}.`
  );
}

const workspaceSource = readFileSync(
  path.join(REPOSITORY_ROOT, "pnpm-workspace.yaml"),
  "utf8"
);
const patchReferences = Array.from(
  workspaceSource.matchAll(/^\s{2}([^\s][^\r\n:]*):\s+(\S+\.patch)\s*$/gm),
  ([, dependency, patchPath]) => ({
    dependency: dependency.replace(/^['"]|['"]$/g, ""),
    patchPath,
  })
);
const expectedPatchReferences = [
  {
    dependency: `next@${NEXT_VERSION}`,
    patchPath: NEXT_PATCH_PATH,
  },
];

if (
  JSON.stringify(patchReferences) !== JSON.stringify(expectedPatchReferences)
) {
  failures.push(
    "pnpm-workspace.yaml patch registrations must match the reviewed allowlist."
  );
}

if (!workspaceSource.includes(NEXT_UPSTREAM_FIX)) {
  failures.push(
    `pnpm-workspace.yaml must keep the stable-release deletion gate for Next.js commit ${NEXT_UPSTREAM_FIX}.`
  );
}

const nextDependencyVersions = readDependencyVersions("next");
const mismatchedNextDependencies = nextDependencyVersions.filter(
  ({ version }) => version !== NEXT_VERSION
);

if (nextDependencyVersions.length === 0) {
  failures.push(
    "No first-party workspace declares the patched Next.js dependency."
  );
}

if (mismatchedNextDependencies.length > 0) {
  failures.push(
    `Delete or revalidate ${NEXT_PATCH_PATH} before changing Next.js from ${NEXT_VERSION}:\n${mismatchedNextDependencies
      .map(({ manifestPath, version }) => `  - ${manifestPath}: ${version}`)
      .join("\n")}`
  );
}

if (patchFiles.includes(NEXT_PATCH_PATH)) {
  const patchSource = readFileSync(path.join(REPOSITORY_ROOT, NEXT_PATCH_PATH));
  const patchHash = createHash("sha256").update(patchSource).digest("hex");

  if (patchHash !== NEXT_PATCH_SHA256) {
    failures.push(
      `${NEXT_PATCH_PATH} changed. Revalidate it against upstream and update the source policy in the same review.`
    );
  }
}

if (failures.length === 0) {
  process.stdout.write("Application patch policy checks passed.\n");
  process.exit(0);
}

process.stderr.write(`${failures.join("\n")}\n`);
process.exitCode = 1;
