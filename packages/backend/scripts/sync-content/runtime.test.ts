import * as fs from "node:fs";
import * as os from "node:os";
import path from "node:path";
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
      expected: "shell-url",
      name: "keeps explicit shell environment above backend .env.local",
      shell: "shell-url",
    },
    {
      expected: "file-url",
      name: "falls back to backend .env.local when the shell is missing",
      shell: null,
    },
  ])("$name", async ({ expected, shell }) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nakafa-sync-"));
    const envFile = path.join(directory, ".env.local");
    fs.writeFileSync(envFile, "CONVEX_URL=file-url\n");

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
      fs.rmSync(directory, { force: true, recursive: true });
    }
  });
});
