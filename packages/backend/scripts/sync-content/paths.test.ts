import path from "node:path";
import {
  BACKEND_DIR,
  getBackendEnvFilePath,
  getSyncStateFile,
} from "@repo/backend/scripts/sync-content/paths";
import { describe, expect, it } from "vitest";

describe("sync-content paths", () => {
  it("resolves development and production sync-state files", () => {
    expect(getSyncStateFile(false)).toBe(
      path.resolve(BACKEND_DIR, ".sync-state.json")
    );
    expect(getSyncStateFile(true)).toBe(
      path.resolve(BACKEND_DIR, ".sync-state.prod.json")
    );
  });

  it("resolves the backend env file path", () => {
    expect(getBackendEnvFilePath()).toBe(
      path.resolve(BACKEND_DIR, ".env.local")
    );
  });
});
