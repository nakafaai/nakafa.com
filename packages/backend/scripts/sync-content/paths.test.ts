import path from "node:path";
import { describe, expect, it } from "@effect/vitest";
import {
  BACKEND_DIR,
  getBackendEnvFilePath,
  getSyncStateFile,
} from "@repo/backend/scripts/sync-content/paths";
import { Effect } from "effect";

describe("sync-content paths", () => {
  it.effect("resolves development and production sync-state files", () =>
    Effect.sync(() => {
      expect(getSyncStateFile(false)).toBe(
        path.resolve(BACKEND_DIR, ".sync-state.json")
      );
      expect(getSyncStateFile(true)).toBe(
        path.resolve(BACKEND_DIR, ".sync-state.prod.json")
      );
    })
  );

  it.effect("resolves the backend env file path", () =>
    Effect.sync(() => {
      expect(getBackendEnvFilePath()).toBe(
        path.resolve(BACKEND_DIR, ".env.local")
      );
    })
  );
});
