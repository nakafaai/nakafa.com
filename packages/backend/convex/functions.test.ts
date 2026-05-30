import { readFile } from "node:fs/promises";
import path from "node:path";
import { glob } from "glob";
import { describe, expect, it } from "vitest";

const backendRoot = path.resolve(import.meta.dirname, "..");
const rawMutationImportPattern =
  /import\s*\{(?<specifiers>[^}]*)\}\s*from\s*["'](?<source>@repo\/backend\/convex\/_generated\/server|(?:\.\.\/)+_generated\/server)["'];/g;
const registeredTablePattern = /triggers\.register\("(?<table>[^"]+)"/g;
const dbWritePattern =
  /ctx\.db\.(?:insert|patch|replace|delete)\("(?<table>[^"]+)"/g;
const importAliasPattern = /\s+as\s+/;
const namedImportAliasPattern = /import\s+(?:type\s+)?\{[^}]*\s+as\s+[^}]*\}/;
const namespaceImportPattern = /import\s+(?:type\s+)?\*\s+as\s+/;
const convexAnyValidatorPattern = /\bv\.any\(\)/;
const confectPattern = /@confect|confect|registeredFunctions/;
const effectSuffixPattern = /\b(?!useEffect\b)[A-Za-z0-9]+Effect\b/;
const useNodeDirectivePattern = /^\s*["']use node["'];?/m;
const appRuntimeAiImportPattern =
  /@repo\/ai\/config\/(?:devtools|vercel)|@ai-sdk\/devtools/;

const rawMutationImportExceptions = new Set([
  "convex/emails/mutations.ts",
  "convex/functions.ts",
]);
const namedImportAliasExceptions = new Set(["convex/functions.ts"]);

async function readBackendFile(relativePath: string) {
  return await readFile(path.join(backendRoot, relativePath), "utf8");
}

function getValueImports(specifiers: string) {
  return specifiers
    .split(",")
    .map((specifier) => specifier.trim())
    .filter((specifier) => !specifier.startsWith("type "))
    .map((specifier) => specifier.split(importAliasPattern)[0]);
}

function extractMatches(source: string, pattern: RegExp, group: string) {
  return [...source.matchAll(pattern)].map((match) => match.groups?.[group]);
}

describe("Convex trigger-aware mutation builders", () => {
  it("keeps app-table mutations on the trigger-aware builders", async () => {
    const files = await glob("convex/**/*.ts", {
      cwd: backendRoot,
      ignore: ["convex/**/*.test.ts", "convex/_generated/**"],
    });
    const rawMutationImportFiles: string[] = [];

    for (const file of files) {
      const source = await readBackendFile(file);

      for (const match of source.matchAll(rawMutationImportPattern)) {
        const valueImports = getValueImports(match.groups?.specifiers ?? "");
        if (
          valueImports.includes("mutation") ||
          valueImports.includes("internalMutation")
        ) {
          rawMutationImportFiles.push(file);
        }
      }
    }

    expect(rawMutationImportFiles.sort()).toEqual(
      [...rawMutationImportExceptions].sort()
    );
  });

  it("does not write registered trigger tables from raw mutation exceptions", async () => {
    const functionsSource = await readBackendFile("convex/functions.ts");
    const registeredTables = new Set(
      extractMatches(functionsSource, registeredTablePattern, "table")
    );

    for (const file of rawMutationImportExceptions) {
      if (file === "convex/functions.ts") {
        continue;
      }

      const source = await readBackendFile(file);
      const writtenRegisteredTables = extractMatches(
        source,
        dbWritePattern,
        "table"
      ).filter((table) => table !== undefined && registeredTables.has(table));

      expect(writtenRegisteredTables, file).toEqual([]);
    }
  });

  it("does not use namespace imports in hand-written backend code", async () => {
    const files = await glob("**/*.ts", {
      cwd: backendRoot,
      ignore: [
        "**/*.test.ts",
        "convex/_generated/**",
        "convex/betterAuth/_generated/**",
        "coverage/**",
        "node_modules/**",
      ],
    });

    const namespaceImportFiles: string[] = [];

    for (const file of files) {
      const source = await readBackendFile(file);

      if (namespaceImportPattern.test(source)) {
        namespaceImportFiles.push(file);
      }
    }

    expect(namespaceImportFiles).toEqual([]);
  });

  it("keeps named import aliases explicit and rare", async () => {
    const files = await glob("**/*.ts", {
      cwd: backendRoot,
      ignore: [
        "**/*.test.ts",
        "convex/_generated/**",
        "convex/betterAuth/_generated/**",
        "coverage/**",
        "node_modules/**",
      ],
    });

    const aliasFiles: string[] = [];

    for (const file of files) {
      if (namedImportAliasExceptions.has(file)) {
        continue;
      }

      const source = await readBackendFile(file);

      if (namedImportAliasPattern.test(source)) {
        aliasFiles.push(file);
      }
    }

    expect(aliasFiles).toEqual([]);
  });

  it("does not use v.any in hand-written Convex validators", async () => {
    const files = await glob("convex/**/*.ts", {
      cwd: backendRoot,
      ignore: [
        "convex/**/*.test.ts",
        "convex/_generated/**",
        "convex/betterAuth/_generated/**",
      ],
    });
    const anyValidatorFiles: string[] = [];

    for (const file of files) {
      const source = await readBackendFile(file);

      if (convexAnyValidatorPattern.test(source)) {
        anyValidatorFiles.push(file);
      }
    }

    expect(anyValidatorFiles).toEqual([]);
  });

  it("does not import or reference Confect in backend code", async () => {
    const files = await glob("**/*.ts", {
      cwd: backendRoot,
      ignore: [
        "**/*.test.ts",
        "convex/_generated/**",
        "convex/betterAuth/_generated/**",
        "coverage/**",
        "node_modules/**",
      ],
    });
    const confectFiles: string[] = [];

    for (const file of files) {
      const source = await readBackendFile(file);

      if (confectPattern.test(source)) {
        confectFiles.push(file);
      }
    }

    expect(confectFiles).toEqual([]);
  });

  it("does not name backend implementation functions with an Effect suffix", async () => {
    const files = await glob("**/*.ts", {
      cwd: backendRoot,
      ignore: [
        "convex/_generated/**",
        "convex/betterAuth/_generated/**",
        "coverage/**",
        "node_modules/**",
      ],
    });
    const effectSuffixFiles: string[] = [];

    for (const file of files) {
      const source = await readBackendFile(file);

      if (effectSuffixPattern.test(source)) {
        effectSuffixFiles.push(file);
      }
    }

    expect(effectSuffixFiles).toEqual([]);
  });

  it("keeps hand-written Convex functions in the default runtime", async () => {
    const files = await glob("convex/**/*.ts", {
      cwd: backendRoot,
      ignore: [
        "convex/**/*.test.ts",
        "convex/_generated/**",
        "convex/betterAuth/_generated/**",
      ],
    });
    const nodeRuntimeFiles: string[] = [];

    for (const file of files) {
      const source = await readBackendFile(file);

      if (useNodeDirectivePattern.test(source)) {
        nodeRuntimeFiles.push(file);
      }
    }

    expect(nodeRuntimeFiles).toEqual([]);
  });

  it("keeps Convex backend code out of app-only AI runtime config", async () => {
    const files = await glob("convex/**/*.ts", {
      cwd: backendRoot,
      ignore: [
        "convex/**/*.test.ts",
        "convex/_generated/**",
        "convex/betterAuth/_generated/**",
      ],
    });
    const appAiRuntimeImportFiles: string[] = [];

    for (const file of files) {
      const source = await readBackendFile(file);

      if (appRuntimeAiImportPattern.test(source)) {
        appAiRuntimeImportFiles.push(file);
      }
    }

    expect(appAiRuntimeImportFiles).toEqual([]);
  });
});
