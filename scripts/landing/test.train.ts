import type { ProofResult } from "@repo/backend/scripts/content/acceptance/result";
import { Array as Arr, Effect, Layer, Ref } from "effect";
import { type Candidate, Repository } from "#scripts/landing/train";
import { Prover } from "#scripts/proof/github";

export const MAIN = "0".repeat(40);
export const pull = (number: number, stack = number): Candidate => ({
  number,
  stack,
  sha: String(number).repeat(40).slice(0, 40),
  title: `Change ${number}`,
  specs: [],
});

/** A proof that fails these specs in Chromium, or passes when there are none. */
export const proof = (
  sha: string,
  failures: readonly string[]
): ProofResult => ({
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
export const world = (options: {
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
    const prove = (sha: string, specs: readonly string[]) =>
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
      );
    const prover = Layer.succeed(Prover, {
      prove,
      verify: (sha, specs) =>
        Effect.gen(function* () {
          const result = yield* prove(sha, specs);
          yield* record(`gate ${sha}`);
          return {
            result,
            gated: !(options.gateFails?.(numbersOf(sha)) ?? false),
          };
        }),
    });
    return { layer: Layer.merge(repository, prover), log };
  });
