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

  vi.resetModules();
  vi.restoreAllMocks();
});

describe("sync-content runtime", () => {
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

      vi.doMock("@repo/backend/scripts/sync-content/paths", async () => {
        const actual = await vi.importActual<
          typeof import("@repo/backend/scripts/sync-content/paths")
        >("@repo/backend/scripts/sync-content/paths");

        return {
          ...actual,
          getBackendEnvFilePath: () => envFile,
        };
      });

      const { loadEnvProvider } = await import(
        "@repo/backend/scripts/sync-content/runtime"
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
