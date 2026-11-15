import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, Ref } from "effect";
import { SMOKE_SPEC, selectGroup, selectSpecs } from "#scripts/proof/select";
import { MAIN, PROCESS_TIMEOUT, SHA } from "#scripts/proof/test.github";
import { type Answer, scriptedShell } from "#scripts/test.shell";

const PRESENT = [
  "apps/www/e2e/quran/landing.browser.ts",
  "apps/www/e2e/quran/surah.browser.ts",
  "apps/www/e2e/tryout/player.browser.ts",
  "apps/www/e2e/tryout/flow/start.browser.ts",
  "apps/www/e2e/school/home.browser.ts",
  "apps/www/e2e/school/fixture.ts",
];

describe("merge group specs", () => {
  it("proves the smoke spec alone for a change to nothing the product runs", () => {
    expect(
      selectSpecs(
        [
          "scripts/proof/select.ts",
          "docs/adr/0048-proof.md",
          "apps/www/README.md",
        ],
        PRESENT
      )
    ).toEqual([SMOKE_SPEC]);
  });

  it("adds the spec files a group changes that its head still holds", () => {
    expect(
      selectSpecs(
        [
          "apps/www/e2e/school/home.browser.ts",
          "apps/www/e2e/school/gone.browser.ts",
          "apps/www/e2e/school/fixture.ts",
        ],
        PRESENT
      )
    ).toEqual(["e2e/quran/landing.browser.ts", "e2e/school/home.browser.ts"]);
  });

  it("adds every spec of a folder that a changed source path names, by a segment or a file name", () => {
    expect(
      selectSpecs(["apps/www/src/routes/$locale/tryout/index.tsx"], PRESENT)
    ).toEqual([
      "e2e/quran/landing.browser.ts",
      "e2e/tryout/flow/start.browser.ts",
      "e2e/tryout/player.browser.ts",
    ]);
    expect(selectSpecs(["apps/www/src/lib/school.ts"], PRESENT)).toEqual([
      "e2e/quran/landing.browser.ts",
      "e2e/school/home.browser.ts",
    ]);
  });

  it("reaches no folder from a path outside the app source", () => {
    expect(
      selectSpecs(["packages/design-system/components/tryout.tsx"], PRESENT)
    ).toEqual([SMOKE_SPEC]);
  });
});

describe("selecting a merge group's specs", () => {
  const select = (
    argv: readonly string[],
    answer: (args: readonly string[]) => Answer | undefined
  ) =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<readonly string[]>([]);
      const exit = yield* selectGroup(argv).pipe(
        Effect.provide(
          scriptedShell(
            (command, args) => (command === "git" ? answer(args) : undefined),
            calls
          )
        ),
        Effect.exit
      );
      return { exit, calls: yield* Ref.get(calls) };
    });

  it.effect(
    "reads the group's diff and the head's specs from Git",
    () =>
      Effect.gen(function* () {
        const { exit, calls } = yield* select([MAIN, SHA], (args) =>
          args[0] === "diff"
            ? { stdout: "apps/www/src/components/school/card.tsx\n" }
            : { stdout: `${Arr.join(PRESENT, "\n")}\n` }
        );
        expect(exit._tag).toBe("Success");
        expect(calls).toEqual([
          `git diff --name-only --no-renames ${MAIN} ${SHA}`,
          `git ls-tree -r --name-only ${SHA} -- apps/www/e2e`,
        ]);
      }).pipe(Effect.provide(NodeServices.layer)),
    PROCESS_TIMEOUT
  );

  it.effect(
    "reads a real diff and tree with Git, here #2563 against its parent on main",
    () =>
      Effect.gen(function* () {
        const { exit, calls } = yield* select(
          [
            "023dfd91e25f6c8391258a669f90daf57b83bafd",
            "5442d613c37a043b8550cf9d61825682b9f741c3",
          ],
          () => undefined
        );
        expect(exit._tag).toBe("Success");
        expect(calls).toEqual([]);
      }).pipe(Effect.provide(NodeServices.layer)),
    PROCESS_TIMEOUT
  );

  it.effect(
    "fails with the usage, with what Git said, or on a path no spec runs",
    () =>
      Effect.gen(function* () {
        const failure = (
          argv: readonly string[],
          answer: (args: readonly string[]) => Answer
        ) =>
          selectGroup(argv).pipe(
            Effect.provide(
              scriptedShell(
                (command, args) =>
                  command === "git" ? answer(args) : undefined,
                Ref.makeUnsafe<readonly string[]>([])
              )
            ),
            Effect.flip,
            Effect.map((error) => error.message)
          );
        expect(yield* failure([MAIN], () => ({}))).toBe(
          "Usage: node scripts/proof/select.ts <base sha> <head sha>"
        );
        expect(
          yield* failure([MAIN, SHA], () => ({
            code: 128,
            stderr: "fatal: bad object\n",
          }))
        ).toBe("git diff failed: fatal: bad object");
        expect(yield* failure([MAIN, SHA], () => ({ missing: true }))).toBe(
          "Git could not start."
        );
        expect(
          yield* failure([MAIN, SHA], () => ({
            stdout: "apps/www/e2e/quran/odd name.browser.ts\n",
          }))
        ).toBe("A selected spec is not a spec path.");
      }).pipe(Effect.provide(NodeServices.layer)),
    PROCESS_TIMEOUT
  );
});
