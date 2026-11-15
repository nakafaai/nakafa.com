import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, FileSystem, Record as Rec } from "effect";
import { judgeGroup, parseGroupArguments } from "#scripts/proof/group";
import {
  github,
  MAIN,
  PROCESS_TIMEOUT,
  SHA,
  shard,
  withGithub,
} from "#scripts/proof/test.github";

const URL = "https://github.com/nakafaai/nakafa.com/actions/runs/9";

/** A folder holding each engine's result where the job's download puts it: one folder per artifact. */
const downloaded = Effect.fn("test.downloaded")(function* (
  results: Readonly<Record<string, string>>
) {
  const fs = yield* FileSystem.FileSystem;
  const folder = yield* fs.makeTempDirectoryScoped({ prefix: "group-" });
  yield* Effect.forEach(Rec.toEntries(results), ([engine, text]) =>
    fs
      .makeDirectory(`${folder}/results-${engine}`)
      .pipe(
        Effect.andThen(
          fs.writeFileString(`${folder}/results-${engine}/result.json`, text)
        )
      )
  );
  return folder;
});

/** The `verify` status a verdict posted, as its command line. */
const verify = (calls: readonly string[]) =>
  Arr.filter(calls, (call) => call.includes("context=verify"));

describe("merge group verdict", () => {
  it.effect("reads the group's head, results and run", () =>
    Effect.gen(function* () {
      expect(yield* parseGroupArguments([SHA, "/tmp/results", URL])).toEqual({
        head: SHA,
        results: "/tmp/results",
        url: URL,
      });
      for (const argv of [[], [SHA], [SHA, "/tmp"], ["main", "/tmp", URL]]) {
        expect(
          (yield* Effect.flip(parseGroupArguments(argv))).message
        ).toContain("Usage: node scripts/proof/group.ts");
      }
    })
  );

  it.effect(
    "sets aside what main's head fails too, and fails on what only the group fails",
    () =>
      Effect.gen(function* () {
        const red = yield* downloaded({
          chromium: shard("chromium", ["e2e/a.browser.ts"]),
          firefox: shard("firefox", ["e2e/b.browser.ts"]),
          webkit: shard("webkit"),
        });
        const shared = yield* withGithub(
          github(undefined, undefined, {
            chromium: shard("chromium", ["e2e/a.browser.ts"]),
            firefox: shard("firefox", ["e2e/b.browser.ts"]),
            webkit: shard("webkit"),
          }),
          judgeGroup([SHA, red, URL])
        );
        yield* shared.exit;
        // Main's head proves only the failing specs, in all three engines.
        expect(
          Arr.some(shared.calls, (call) =>
            call.includes(
              `-f sha=${MAIN} -f specs=e2e/a.browser.ts e2e/b.browser.ts -f gate=false`
            )
          )
        ).toBe(true);
        expect(verify(shared.calls)).toEqual([
          `gh api --silent repos/nakafaai/nakafa.com/statuses/${SHA} -f state=success -f context=verify -f target_url=${URL} -f description=No new failure against main ${MAIN.slice(0, 10)}; 2 fail there too`,
        ]);

        const fresh = yield* withGithub(
          github(undefined, undefined, {
            chromium: shard("chromium", ["e2e/a.browser.ts"]),
            firefox: shard("firefox"),
            webkit: shard("webkit"),
          }),
          judgeGroup([SHA, red, URL])
        );
        yield* fresh.exit;
        expect(verify(fresh.calls)).toEqual([
          `gh api --silent repos/nakafaai/nakafa.com/statuses/${SHA} -f state=failure -f context=verify -f target_url=${URL} -f description=1 new failures against main ${MAIN.slice(0, 10)}`,
        ]);
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
    PROCESS_TIMEOUT
  );

  it.effect(
    "fails an engine that never reported without proving main, and passes results that all passed",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const empty = `${yield* fs.makeTempDirectoryScoped({ prefix: "group-" })}/none`;
        const silent = yield* withGithub(
          github(undefined),
          judgeGroup([SHA, empty, URL])
        );
        yield* silent.exit;
        expect(
          Arr.some(silent.calls, (call) => call.startsWith("gh workflow run"))
        ).toBe(false);
        expect(verify(silent.calls)).toEqual([
          `gh api --silent repos/nakafaai/nakafa.com/statuses/${SHA} -f state=failure -f context=verify -f target_url=${URL} -f description=1 new failures against main ${MAIN.slice(0, 10)}`,
        ]);

        const green = yield* downloaded({
          chromium: shard("chromium"),
          firefox: shard("firefox"),
          webkit: shard("webkit"),
        });
        const passed = yield* withGithub(
          github(undefined),
          judgeGroup([SHA, green, URL])
        );
        yield* passed.exit;
        expect(
          Arr.some(passed.calls, (call) => call.startsWith("gh workflow run"))
        ).toBe(false);
        expect(verify(passed.calls)).toEqual([
          `gh api --silent repos/nakafaai/nakafa.com/statuses/${SHA} -f state=success -f context=verify -f target_url=${URL} -f description=No new failure against main ${MAIN.slice(0, 10)}; 0 fail there too`,
        ]);
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
    PROCESS_TIMEOUT
  );
});
