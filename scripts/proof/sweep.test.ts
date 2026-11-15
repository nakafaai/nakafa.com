import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { sweepSuperseded } from "#scripts/proof/sweep";
import { github, MAIN, toJson, withGithub } from "#scripts/proof/test.github";

describe("superseded proof runs", () => {
  it.effect(
    "cancels the queued runs of heads no pull request, train or main holds",
    () =>
      Effect.gen(function* () {
        const open = "1".repeat(40);
        const train = "2".repeat(40);
        const gone = "3".repeat(40);
        const refused = "4".repeat(40);
        // A baseline of a commit main has since moved past.
        const onMain = "5".repeat(40);
        const { exit, calls } = yield* withGithub((args) => {
          if (args[0] === "pr") {
            return { stdout: `${open}\n` };
          }
          if (args[0] === "api") {
            return {
              stdout: Arr.some(args, (arg) => arg.includes("matching-refs"))
                ? `${train}\n`
                : `${MAIN}\n`,
            };
          }
          if (args[0] === "fetch") {
            return {};
          }
          if (args[0] === "merge-base") {
            return { code: args[2] === onMain ? 0 : 1 };
          }
          if (args[1] === "cancel") {
            return args[2] === "14"
              ? {
                  code: 1,
                  stderr: "Cannot cancel a workflow run that is completed",
                }
              : {};
          }
          return {
            stdout: toJson([
              { databaseId: 10, displayTitle: `Proof ${open} a` },
              { databaseId: 11, displayTitle: `Proof ${train} b` },
              { databaseId: 12, displayTitle: `Proof ${MAIN} c` },
              { databaseId: 13, displayTitle: `Proof ${gone} d` },
              { databaseId: 14, displayTitle: `Proof ${refused} e` },
              { databaseId: 15, displayTitle: `Gate ${gone} f` },
              { databaseId: 16, displayTitle: `Proof ${onMain} g` },
            ]),
          };
        }, sweepSuperseded());
        expect(yield* exit).toBe(2);
        expect(
          Arr.filter(calls, (call) => call.startsWith("gh run cancel"))
        ).toEqual([
          "gh run cancel 13 --repo nakafaai/nakafa.com",
          "gh run cancel 14 --repo nakafaai/nakafa.com",
        ]);
      }).pipe(Effect.provide(NodeServices.layer))
  );
});
describe("superseded proof runs without Git", () => {
  it.effect("fails when Git cannot fetch main or cannot start", () =>
    Effect.gen(function* () {
      const answer = github({});
      const offline = yield* withGithub(
        (args) =>
          args[0] === "fetch"
            ? { code: 1, stderr: "fatal: unable to access origin\n" }
            : answer(args),
        sweepSuperseded()
      );
      expect((yield* Effect.flip(offline.exit)).message).toBe(
        "git fetch failed: fatal: unable to access origin"
      );
      const missing = yield* withGithub(
        (args) => (args[0] === "fetch" ? { missing: true } : answer(args)),
        sweepSuperseded()
      );
      expect((yield* Effect.flip(missing.exit)).message).toBe(
        "Git could not start."
      );
    }).pipe(Effect.provide(NodeServices.layer))
  );
});
