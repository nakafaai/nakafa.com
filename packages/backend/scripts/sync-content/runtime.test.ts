import * as fs from "node:fs";
import * as os from "node:os";
import path from "node:path";
import { Config, ConfigProvider, Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
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
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nakafa-sync-"));
    const envFile = path.join(directory, ".env.local");
    fs.writeFileSync(envFile, content);

    try {
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
          const shellValues =
            shell === null
              ? new Map<string, string>()
              : new Map([["CONVEX_URL", shell]]);
          const provider = yield* loadEnvProvider(
            ConfigProvider.fromMap(shellValues)
          );

          return yield* Config.string("CONVEX_URL").pipe(
            Effect.withConfigProvider(provider)
          );
        })
      );

      expect(value).toBe(expected);
    } finally {
      fs.rmSync(directory, { force: true, recursive: true });
    }
  });
});
