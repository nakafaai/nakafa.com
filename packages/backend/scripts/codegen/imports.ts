import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scopedRegistryGroups } from "@repo/backend/scripts/codegen/scopedRegistry.config";
import { writeScopedRegisteredFunctions } from "@repo/backend/scripts/codegen/scopedRegistry.files";
import {
  formatScriptCause,
  getUnknownMessage,
  ScriptFailureError,
} from "@repo/backend/scripts/lib/errors";
import { log, logError } from "@repo/backend/scripts/sync-content/logging";
import { Effect } from "effect";

const moduleFileName = fileURLToPath(import.meta.url);
const moduleDir = path.dirname(moduleFileName);
const BACKEND_DIR = path.resolve(moduleDir, "../..");

const sourceExtensions = [".ts", ".tsx", ".mts", ".cts"] as const;
const normalizedSourceRoots = [
  path.resolve(BACKEND_DIR, "convex"),
  path.resolve(BACKEND_DIR, "confect/_generated"),
] as const;
const convexDirectory = path.resolve(BACKEND_DIR, "convex");
const aliasRoots = [
  {
    alias: "@repo/backend/confect",
    directory: path.resolve(BACKEND_DIR, "confect"),
  },
  {
    alias: "@repo/backend/convex",
    directory: path.resolve(BACKEND_DIR, "convex"),
  },
  {
    alias: "@repo/backend/scripts",
    directory: path.resolve(BACKEND_DIR, "scripts"),
  },
] as const;
const scopedRegisteredFunctionsImport =
  "@repo/backend/confect/_generated/registeredFunctions";
const sourceModuleExtensionPattern = /\.[cm]?tsx?$/;

const importPatterns = [
  /(from\s*["'])(\.\.?\/[^"']+)(["'])/g,
  /(import\s*\(\s*["'])(\.\.?\/[^"']+)(["']\s*\))/g,
  /(import\s*["'])(\.\.?\/[^"']+)(["'])/g,
] as const;

/** Normalizes Confect-generated imports to backend package aliases. */
const main = Effect.gen(function* () {
  const changedScopedRegistryFileCount =
    yield* writeScopedRegisteredFunctions();
  const files = yield* collectSourceFiles(normalizedSourceRoots);
  let changedFileCount = 0;

  for (const file of files) {
    const changed = yield* normalizeFileImports(file);

    if (changed) {
      changedFileCount += 1;
    }
  }

  if (changedFileCount === 0 && changedScopedRegistryFileCount === 0) {
    yield* Effect.sync(() =>
      log("Confect generated imports already use aliases.")
    );
    return;
  }

  yield* Effect.sync(() =>
    log(
      `Normalized generated imports in ${changedFileCount} files and refreshed ${changedScopedRegistryFileCount} scoped registries.`
    )
  );
});

/** Recursively collects source files from the generated output roots. */
const collectSourceFiles = Effect.fn("codegen.collectSourceFiles")(function* (
  roots: readonly string[]
) {
  const files: string[] = [];
  const directories = [...roots];

  while (directories.length > 0) {
    const directory = directories.pop();

    if (directory === undefined) {
      continue;
    }

    const entries = yield* Effect.tryPromise({
      try: () => readdir(directory, { withFileTypes: true }),
      catch: (error) =>
        new ScriptFailureError({ message: getUnknownMessage(error) }),
    });

    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        if (entryPath !== path.resolve(BACKEND_DIR, "convex/_generated")) {
          directories.push(entryPath);
        }
        continue;
      }

      if (entry.isFile() && isSourceFile(entryPath)) {
        files.push(entryPath);
      }
    }
  }

  return files;
});

/** Rewrites one file when it contains relative imports covered by aliases. */
const normalizeFileImports = Effect.fn("codegen.normalizeFileImports")(
  function* (file: string) {
    const source = yield* Effect.tryPromise({
      try: () => readFile(file, "utf8"),
      catch: (error) =>
        new ScriptFailureError({ message: getUnknownMessage(error) }),
    });
    const normalized = normalizeSourceImports(file, source);

    if (normalized === source) {
      return false;
    }

    yield* Effect.tryPromise({
      try: () => writeFile(file, normalized),
      catch: (error) =>
        new ScriptFailureError({ message: getUnknownMessage(error) }),
    });
    return true;
  }
);

/** Converts relative imports in one source string when the target has an alias. */
function normalizeSourceImports(file: string, source: string) {
  let normalized = source;

  for (const pattern of importPatterns) {
    normalized = normalized.replace(
      pattern,
      (match, prefix, specifier, suffix) => {
        const aliasSpecifier = getAliasSpecifier(file, specifier);

        if (aliasSpecifier === null) {
          return match;
        }

        return `${prefix}${aliasSpecifier}${suffix}`;
      }
    );
  }

  normalized = normalizeRegisteredFunctionImport(file, normalized);

  return normalized;
}

/** Repoints generated Convex modules at scoped registries. */
function normalizeRegisteredFunctionImport(file: string, source: string) {
  const group = getConvexFunctionGroup(file);

  if (!group) {
    return source;
  }

  return source.replace(
    scopedRegisteredFunctionsImport,
    `@repo/backend/confect/_generated/registered/${group}`
  );
}

/** Returns the alias import specifier for a relative import when one exists. */
function getAliasSpecifier(file: string, specifier: string) {
  if (!specifier.startsWith(".")) {
    return null;
  }

  const resolvedImport = path.resolve(path.dirname(file), specifier);

  for (const root of aliasRoots) {
    if (!isInsideDirectory(root.directory, resolvedImport)) {
      continue;
    }

    const relativePath = path.relative(root.directory, resolvedImport);
    const suffix = toPosixPath(relativePath);

    if (suffix.length === 0) {
      return root.alias;
    }

    return `${root.alias}/${suffix}`;
  }

  return null;
}

/** Returns the top-level Confect group for a generated Convex function file. */
function getConvexFunctionGroup(file: string) {
  if (!isInsideDirectory(convexDirectory, file)) {
    return null;
  }

  const relativePath = toPosixPath(path.relative(convexDirectory, file));

  if (
    relativePath.startsWith("_generated/") ||
    relativePath.startsWith("node/")
  ) {
    return null;
  }

  const [firstSegment] = relativePath.split("/");
  const group = firstSegment?.replace(sourceModuleExtensionPattern, "");

  if (group === undefined || !scopedRegistryGroups.has(group)) {
    return null;
  }

  return group;
}

/** Checks whether a path points to a TypeScript source file. */
function isSourceFile(file: string) {
  return sourceExtensions.some((extension) => file.endsWith(extension));
}

/** Checks whether a resolved path lives inside a resolved directory. */
function isInsideDirectory(directory: string, target: string) {
  const relativePath = path.relative(directory, target);
  return (
    relativePath.length === 0 ||
    !(relativePath.startsWith("..") || path.isAbsolute(relativePath))
  );
}

/** Converts Node path separators to import specifier separators. */
function toPosixPath(file: string) {
  return file.split(path.sep).join("/");
}

Effect.runPromise(
  main.pipe(
    Effect.catchAllCause((cause) =>
      Effect.sync(() => {
        logError(formatScriptCause(cause));
        process.exitCode = 1;
      })
    )
  )
);
