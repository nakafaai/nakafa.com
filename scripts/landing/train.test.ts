import { describe, expect, it } from "@effect/vitest";
import type { ProofResult } from "@repo/backend/scripts/content/acceptance/result";
import { Array as Arr, Effect, Layer, Ref } from "effect";
import {
  type Candidate,
  formatTrain,
  Repository,
  runTrain,
} from "#scripts/landing/train";
import { Prover } from "#scripts/proof/github";

const MAIN = "0".repeat(40);
const pull = (number: number): Candidate => ({
  number,
  sha: String(number).repeat(40).slice(0, 40),
  title: `Change ${number}`,
  specs: [],
});

/** A proof that fails these specs in Chromium, or passes when there are none. */
const proof = (sha: string, failures: readonly string[]): ProofResult => ({
  sha,
  url: "https://run",
  passed: failures.length === 0,
  engines: {
    chromium: { passed: failures.length === 0, failures },
    firefox: { passed: true, failures: [] },
    webkit: { passed: true, failures: [] },
  },
});

/** The pull requests a combination's SHA names. */
const numbersOf = (sha: string) =>
  Arr.map(
    Arr.filter(sha.slice(6).split(","), (part) => part !== ""),
    Number
  );

/** The named pull requests of a list, or all of them when none is named. */
const named = (pulls: readonly Candidate[], numbers: readonly number[]) =>
  Effect.succeed(
    numbers.length === 0
      ? pulls
      : Arr.filter(pulls, (one) => Arr.contains(numbers, one.number))
  );

/**
 * A repository and a prover where each combination's SHA names the pull
 * requests it merged, and the proof fails the specs that `fails` gives for
 * those pull requests, or main's specs when it proves main. Waiting pull
 * requests have no proof of their own, so only a batch takes them, and the gate
 * of a combination fails when `gateFails` says so.
 */
const world = (options: {
  readonly pulls: readonly Candidate[];
  readonly fails: (numbers: readonly number[]) => readonly string[];
  readonly waiting?: readonly Candidate[];
  readonly gateFails?: (numbers: readonly number[]) => boolean;
  readonly mainFails?: readonly string[];
  readonly conflicts?: readonly number[];
  readonly skips?: readonly number[];
}) =>
  Effect.gen(function* () {
    const log = yield* Ref.make<readonly string[]>([]);
    const record = (line: string) => Ref.update(log, Arr.append(line));
    const repository = Layer.succeed(Repository, {
      proven: (numbers) => named(options.pulls, numbers),
      ready: (numbers) =>
        named([...options.pulls, ...(options.waiting ?? [])], numbers),
      gate: (sha) =>
        record(`gate ${sha}`).pipe(
          Effect.as(!(options.gateFails?.(numbersOf(sha)) ?? false))
        ),
      main: Effect.succeed(MAIN),
      combine: (base, heads) =>
        Effect.gen(function* () {
          const conflicted = Arr.filter(heads, (head) =>
            Arr.contains(options.conflicts ?? [], head.number)
          );
          const merged = Arr.filter(
            heads,
            (head) => !Arr.contains(options.conflicts ?? [], head.number)
          );
          yield* record(
            `combine ${base.slice(0, 1)} ${Arr.join(
              Arr.map(heads, (head) => String(head.number)),
              ","
            )}`
          );
          return {
            sha: `merge:${Arr.join(
              Arr.map(merged, (head) => String(head.number)),
              ","
            )}`,
            merged,
            conflicted,
          };
        }),
      land: (candidate) =>
        record(`land ${candidate.number}`).pipe(
          Effect.as(
            Arr.contains(options.skips ?? [], candidate.number)
              ? {
                  _tag: "skipped" as const,
                  candidate,
                  reason: "its head moved after its proof: prove the new head",
                }
              : { _tag: "landed" as const, candidate }
          )
        ),
      deploy: record("deploy"),
    });
    const prover = Layer.succeed(Prover, {
      prove: (sha, specs) =>
        record(`prove ${sha} ${Arr.join(specs, " ")}`.trim()).pipe(
          Effect.as(
            sha === MAIN
              ? proof(
                  sha,
                  Arr.filter(options.mainFails ?? [], (spec) =>
                    Arr.contains(specs, spec)
                  )
                )
              : proof(sha, options.fails(numbersOf(sha)))
          )
        ),
    });
    return { layer: Layer.merge(repository, prover), log };
  });

describe("landing train", () => {
  it.effect("lands a passing combination in one proof and one deploy", () =>
    Effect.gen(function* () {
      const { layer, log } = yield* world({
        pulls: [pull(1), pull(2), pull(3)],
        fails: () => [],
      });
      const report = yield* runTrain([], [], false).pipe(Effect.provide(layer));
      expect(Arr.map(report.landed, (one) => one.number)).toEqual([1, 2, 3]);
      expect(yield* Ref.get(log)).toEqual([
        "combine 0 1,2,3",
        "prove merge:1,2,3",
        "gate merge:1,2,3",
        "land 1",
        "land 2",
        "land 3",
        "deploy",
      ]);
      expect(formatTrain(report)).toContain("one production deploy started");
    })
  );

  it.effect("proves a combination on the specs its pull requests change", () =>
    Effect.gen(function* () {
      const { layer, log } = yield* world({
        pulls: [
          { ...pull(1), specs: ["e2e/b.browser.ts", "e2e/a.browser.ts"] },
          { ...pull(2), specs: ["e2e/a.browser.ts"] },
        ],
        fails: () => [],
      });
      yield* runTrain([], ["e2e/c.browser.ts"], false).pipe(
        Effect.provide(layer)
      );
      expect(yield* Ref.get(log)).toContain(
        "prove merge:1,2 e2e/a.browser.ts e2e/b.browser.ts e2e/c.browser.ts"
      );
    })
  );

  it.effect(
    "ignores a spec that fails on main too and reports it for main",
    () =>
      Effect.gen(function* () {
        const { layer, log } = yield* world({
          pulls: [pull(1), pull(2)],
          fails: () => ["e2e/main/red.browser.ts"],
          mainFails: ["e2e/main/red.browser.ts"],
        });
        const report = yield* runTrain([], [], false).pipe(
          Effect.provide(layer)
        );
        expect(report.landed).toHaveLength(2);
        expect(report.mainFailures).toEqual(["e2e/main/red.browser.ts"]);
        expect(yield* Ref.get(log)).toContain(
          `prove ${MAIN} e2e/main/red.browser.ts`
        );
        expect(formatTrain(report)).toContain(
          "main fails e2e/main/red.browser.ts"
        );
      })
  );

  it.effect(
    "bisects a new failure to the pull request that causes it and lands the rest",
    () =>
      Effect.gen(function* () {
        const { layer, log } = yield* world({
          pulls: [pull(1), pull(2), pull(3), pull(4), pull(5)],
          fails: (numbers) =>
            Arr.contains(numbers, 4) ? ["e2e/four/broken.browser.ts"] : [],
        });
        const report = yield* runTrain(
          [],
          ["e2e/four/broken.browser.ts"],
          false
        ).pipe(Effect.provide(layer));
        expect(Arr.map(report.landed, (one) => one.number)).toEqual([
          1, 2, 3, 5,
        ]);
        expect(report.rejected).toEqual([
          { candidate: pull(4), reason: "fails e2e/four/broken.browser.ts" },
        ]);
        // Main passes the spec once, and the train never proves main for it again.
        expect(
          Arr.filter(yield* Ref.get(log), (line) => line.includes(MAIN))
        ).toHaveLength(1);
        expect(yield* Ref.get(log)).toContain("combine 0 1,2,3,4,5");
        expect(yield* Ref.get(log)).toContain("combine 0 1,2,3,4");
        expect(yield* Ref.get(log)).toContain("combine 0 1,2,3,5");
        expect(formatTrain(report)).toContain("rejected #4");
      })
  );

  it.effect(
    "rejects a conflicting pull request, and an incomplete proof is a failure of the batch",
    () =>
      Effect.gen(function* () {
        const { layer } = yield* world({
          pulls: [pull(1), pull(2), pull(3)],
          conflicts: [2],
          fails: (numbers) =>
            Arr.contains(numbers, 3) ? ["suite:visual"] : [],
        });
        const report = yield* runTrain([], [], false).pipe(
          Effect.provide(layer)
        );
        expect(Arr.map(report.landed, (one) => one.number)).toEqual([1]);
        expect(Arr.map(report.rejected, (one) => one.candidate.number)).toEqual(
          [2, 3]
        );

        const broken = yield* world({
          pulls: [pull(7)],
          fails: () => [],
        });
        const failing = Layer.merge(
          broken.layer,
          Layer.succeed(Prover, {
            prove: (sha) =>
              Effect.succeed({
                ...proof(sha, []),
                passed: false,
              }),
          })
        );
        const incomplete = yield* runTrain([], [], false).pipe(
          Effect.provide(failing)
        );
        expect(incomplete.rejected).toEqual([
          { candidate: pull(7), reason: "fails proof:incomplete" },
        ]);
        expect(formatTrain(incomplete)).toContain("nothing landed, no deploy");
      })
  );

  it.effect(
    "takes only the named pull requests, proves nothing without one and reports a skipped landing",
    () =>
      Effect.gen(function* () {
        const { layer, log } = yield* world({
          pulls: [pull(1), pull(2)],
          fails: () => [],
          skips: [2],
        });
        const report = yield* runTrain([2], [], false).pipe(
          Effect.provide(layer)
        );
        expect(report.landed).toEqual([]);
        expect(report.skipped).toEqual([
          {
            candidate: pull(2),
            reason: "its head moved after its proof: prove the new head",
          },
        ]);
        expect(yield* Ref.get(log)).not.toContain("deploy");
        expect(formatTrain(report)).toContain("skipped #2");

        const empty = yield* world({ pulls: [], fails: () => [] });
        const none = yield* runTrain([], [], false).pipe(
          Effect.provide(empty.layer)
        );
        expect(none.landed).toEqual([]);
        expect(yield* Ref.get(empty.log)).toEqual([]);

        const conflicting = yield* world({
          pulls: [pull(3)],
          conflicts: [3],
          fails: () => [],
        });
        const rejected = yield* runTrain([], [], false).pipe(
          Effect.provide(conflicting.layer)
        );
        expect(rejected.rejected[0]?.reason).toContain("merge main into it");
        expect(
          Arr.filter(yield* Ref.get(conflicting.log), (line) =>
            line.startsWith("prove")
          )
        ).toEqual([]);
      })
  );

  it.effect(
    "in a batch takes every ready pull request and bisects a failed gate of their combination",
    () =>
      Effect.gen(function* () {
        const options = {
          pulls: [pull(1)],
          waiting: [pull(2), pull(3)],
          fails: () => [],
          gateFails: (numbers: readonly number[]) => Arr.contains(numbers, 3),
        };
        const { layer, log } = yield* world(options);
        const report = yield* runTrain([], [], true).pipe(
          Effect.provide(layer)
        );
        expect(Arr.map(report.landed, (one) => one.number)).toEqual([1, 2]);
        expect(report.rejected).toEqual([
          { candidate: pull(3), reason: "fails gate:combination" },
        ]);
        expect(
          Arr.filter(yield* Ref.get(log), (line) => line.startsWith("gate"))
        ).toEqual(["gate merge:1,2,3", "gate merge:1,2", "gate merge:1,2,3"]);
        // A failed gate is no spec, so the train never proves main for it.
        expect(
          Arr.filter(yield* Ref.get(log), (line) => line.includes(MAIN))
        ).toEqual([]);

        const proven = yield* world(options);
        const alone = yield* runTrain([], [], false).pipe(
          Effect.provide(proven.layer)
        );
        expect(Arr.map(alone.landed, (one) => one.number)).toEqual([1]);
      })
  );
});
