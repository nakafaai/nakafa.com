import { afterEach, describe, expect, it, vi } from "@effect/vitest";
import {
  formatDuration,
  formatSyncResult,
  log,
  logError,
  logPhaseMetrics,
  logStaleItems,
  logSuccess,
  logSyncMetrics,
  logWarning,
} from "@repo/backend/scripts/sync-content/logging";
import { Effect } from "effect";

afterEach(() => {
  vi.restoreAllMocks();
});
describe("sync-content logging", () => {
  it.effect(
    "writes plain, error, warning, and success messages to the expected streams",
    () =>
      Effect.sync(() => {
        const stdout = vi
          .spyOn(process.stdout, "write")
          .mockImplementation(() => true);
        const stderr = vi
          .spyOn(process.stderr, "write")
          .mockImplementation(() => true);
        log("plain");
        logSuccess("done");
        logWarning("careful");
        logError("failed");
        expect(stdout).toHaveBeenNthCalledWith(1, "plain\n");
        expect(stdout).toHaveBeenNthCalledWith(2, "OK: done\n");
        expect(stderr).toHaveBeenNthCalledWith(1, "WARNING: careful\n");
        expect(stderr).toHaveBeenNthCalledWith(2, "ERROR: failed\n");
      })
  );
  it.effect("formats short, second-scale, and minute-scale durations", () =>
    Effect.sync(() => {
      expect(formatDuration(999)).toBe("999ms");
      expect(formatDuration(1500)).toBe("1.50s");
      expect(formatDuration(65_250)).toBe("1m 5.3s");
    })
  );
  it.effect(
    "formats sync results with change, skipped, and related counts",
    () =>
      Effect.sync(() => {
        expect(
          formatSyncResult({
            authorLinksCreated: 4,
            choicesCreated: 3,
            created: 2,
            referencesCreated: 5,
            skipped: 1,
            unchanged: 7,
            updated: 6,
          })
        ).toBe(
          "15 synced (2 new, 6 updated) - 1 skipped + 5 refs, 3 choices, 4 author links"
        );
        expect(
          formatSyncResult({
            created: 0,
            skipped: 0,
            unchanged: 9,
            updated: 0,
          })
        ).toBe("9 synced (up to date)");
      })
  );
  it.effect(
    "logs phase and aggregate metrics for complete and partial measurements",
    () =>
      Effect.sync(() => {
        const stdout = vi
          .spyOn(process.stdout, "write")
          .mockImplementation(() => true);
        logPhaseMetrics({ itemCount: 2, phase: "load", startTime: 0 });
        logPhaseMetrics({
          durationMs: 1500,
          itemCount: 3,
          itemsPerSecond: 2,
          phase: "sync",
          startTime: 0,
        });
        logSyncMetrics({
          phases: [
            {
              durationMs: 500,
              itemCount: 5,
              itemsPerSecond: 10,
              phase: "write",
              startTime: 0,
            },
          ],
          totalDurationMs: 1000,
          totalItems: 20,
          totalStartTime: 0,
        });
        logSyncMetrics({
          phases: [],
          totalDurationMs: 0,
          totalItems: 0,
          totalStartTime: 0,
        });
        logSyncMetrics({
          phases: [],
          totalDurationMs: 1,
          totalStartTime: 0,
        });
        logSyncMetrics({
          phases: [],
          totalStartTime: 0,
        });
        const output = stdout.mock.calls.map(([message]) => message).join("");
        expect(output).toContain("load: 2 items in N/A (N/A/sec)");
        expect(output).toContain("sync: 3 items in 1.50s (2.0/sec)");
        expect(output).toContain("write: 5 items in 500ms (10.0/sec)");
        expect(output).toContain("Total: 20 items in 1.00s");
        expect(output).toContain("Overall rate: 20.0 items/sec");
        expect(output).toContain("Total: 0 items in 0ms");
        expect(output).toContain("Overall rate: N/A items/sec");
      })
  );
  it.effect(
    "logs stale items only when rows exist and truncates long lists",
    () =>
      Effect.sync(() => {
        const stdout = vi
          .spyOn(process.stdout, "write")
          .mockImplementation(() => true);
        logStaleItems("Empty", []);
        logStaleItems("Single", [{ id: "single", locale: "id", slug: "only" }]);
        logStaleItems(
          "Stale",
          [
            { id: "a", locale: "id", slug: "one" },
            { id: "b", locale: "en", slug: "two" },
            { id: "c", locale: "id", slug: "three" },
          ],
          2
        );
        const output = stdout.mock.calls.map(([message]) => message).join("");
        expect(output).not.toContain("Empty");
        expect(output).toContain("Single (1):");
        expect(output).toContain("- only (id)");
        expect(output).toContain("Stale (3):");
        expect(output).toContain("- one (id)");
        expect(output).toContain("- two (en)");
        expect(output).toContain("... and 1 more");
      })
  );
});
