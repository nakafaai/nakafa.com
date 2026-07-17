import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Config, Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalConvexUrl = process.env.CONVEX_URL;

afterEach(() => {
  if (originalConvexUrl) {
    process.env.CONVEX_URL = originalConvexUrl;
  } else {
    delete process.env.CONVEX_URL;
  }

  vi.doUnmock("node:child_process");
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("sync-content runtime", () => {
  it("reads the deleted side of renames without relying on path existence", async () => {
    const directory = mkdtempSync(join(tmpdir(), "nakafa-sync-"));
    const commands: string[] = [];

    try {
      vi.doMock("node:child_process", () => ({
        execSync: (command: string) => {
          commands.push(command);

          if (command.includes("previous-commit HEAD")) {
            return "articles/politics/old-slug/id.mdx\n";
          }

          return "";
        },
      }));
      vi.doMock(
        "@repo/backend/scripts/sync-content/runtime/paths",
        async () => {
          const actual = await vi.importActual<
            typeof import("@repo/backend/scripts/sync-content/runtime/paths")
          >("@repo/backend/scripts/sync-content/runtime/paths");

          return { ...actual, CONTENTS_DIR: directory };
        }
      );

      const { getDeletedFilesSince } = await import(
        "@repo/backend/scripts/sync-content/runtime/files"
      );
      const deletedFiles = await Effect.runPromise(
        getDeletedFilesSince("previous-commit")
      );

      expect([...deletedFiles]).toEqual([
        join(directory, "articles/politics/old-slug/id.mdx"),
      ]);
      expect(commands).toHaveLength(3);
      expect(
        commands.every((command) => command.includes("--no-renames"))
      ).toBe(true);
      expect(
        commands.every((command) => command.includes("--diff-filter=D"))
      ).toBe(true);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it.each([
    {
      content: "CONVEX_URL=file-url\n",
      expected: "shell-url",
      name: "keeps explicit shell environment above backend .env.local",
      shell: "shell-url",
    },
    {
      content: 'CONVEX_URL="file-url"\n',
      expected: "file-url",
      name: "falls back to dotenv-quoted backend .env.local",
      shell: null,
    },
  ])("$name", async ({ content, expected, shell }) => {
    const directory = mkdtempSync(join(tmpdir(), "nakafa-sync-"));
    const envFile = join(directory, ".env.local");
    writeFileSync(envFile, content);

    try {
      if (shell) {
        process.env.CONVEX_URL = shell;
      } else {
        delete process.env.CONVEX_URL;
      }

      vi.doMock(
        "@repo/backend/scripts/sync-content/runtime/paths",
        async () => {
          const actual = await vi.importActual<
            typeof import("@repo/backend/scripts/sync-content/runtime/paths")
          >("@repo/backend/scripts/sync-content/runtime/paths");

          return {
            ...actual,
            getBackendEnvFilePath: () => envFile,
          };
        }
      );

      const { loadEnvProvider } = await import(
        "@repo/backend/scripts/sync-content/runtime/files"
      );
      const value = await Effect.runPromise(
        Effect.gen(function* () {
          const provider = yield* loadEnvProvider();

          return yield* Config.string("CONVEX_URL").pipe(
            Effect.withConfigProvider(provider)
          );
        })
      );

      expect(value).toBe(expected);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });
});
