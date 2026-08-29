import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem } from "effect";
import { parse as yamlParse } from "yaml";
import {
  GITHUB_ACTION_REVIEWS,
  type GithubActionUse,
  inspectGithubActionPolicy,
  validateGithubActionPolicy,
} from "#scripts/github/policy";

const REPOSITORY_ROOT = fileURLToPath(new URL("../..", import.meta.url));

const readRepositoryFile = Effect.fn("GithubPolicyTest.readRepositoryFile")(
  function* (relativeUrl: string) {
    const fileSystem = yield* FileSystem.FileSystem;
    return yield* fileSystem.readFileString(
      fileURLToPath(new URL(relativeUrl, import.meta.url))
    );
  }
);

const parseWorkflow = Effect.fn("GithubPolicyTest.parseWorkflow")(
  (source: string) =>
    Effect.try({
      try: () => yamlParse(source) as unknown,
      catch: (cause) => String(cause),
    })
);

function validActionUses(): GithubActionUse[] {
  return GITHUB_ACTION_REVIEWS.flatMap((review) =>
    Array.from({ length: review.expectedUsages }, (_, index) => ({
      inputs: review.expectedInputs ?? {},
      reference: `${review.action}@${review.approvedSha}`,
      workflowPath: `.github/workflows/example-${index}.yml`,
    }))
  );
}

describe("GitHub Action policy", () => {
  it.effect(
    "runs candidate validation before merge without repeating it on main",
    () =>
      Effect.gen(function* () {
        for (const fileName of ["agent-docs.yml", "react-doctor.yml"]) {
          const source = yield* readRepositoryFile(
            `../../.github/workflows/${fileName}`
          );
          const workflow = yield* parseWorkflow(source);

          expect(workflow).toEqual(
            expect.objectContaining({
              on: expect.objectContaining({
                merge_group: expect.any(Object),
                pull_request: expect.any(Object),
              }),
            })
          );
          expect(workflow).not.toEqual(
            expect.objectContaining({
              on: expect.objectContaining({ push: expect.anything() }),
            })
          );
        }

        const cacheSource = yield* readRepositoryFile(
          "../../.github/workflows/cache.yml"
        );
        const cacheWorkflow = yield* parseWorkflow(cacheSource);
        expect(cacheWorkflow).toEqual(
          expect.objectContaining({
            jobs: {
              publish: expect.objectContaining({ name: "Publish" }),
            },
            on: {
              push: { branches: ["main"] },
            },
          })
        );
        expect(cacheWorkflow).not.toEqual(
          expect.objectContaining({
            on: expect.objectContaining({ merge_group: expect.anything() }),
          })
        );
        expect(cacheWorkflow).not.toEqual(
          expect.objectContaining({
            on: expect.objectContaining({ pull_request: expect.anything() }),
          })
        );
      }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect(
    "runs changed React checks on pull requests and full checks in the queue",
    () =>
      readRepositoryFile("../../.github/workflows/react-doctor.yml").pipe(
        Effect.tap((source) =>
          Effect.sync(() => {
            expect(source).toContain(
              'pnpm run doctor --verbose --scope changed --base "$DOCTOR_BASE"'
            );
            expect(source).toContain(
              "pnpm run doctor --verbose --scope full --blocking warning"
            );
          })
        ),
        Effect.provide(NodeServices.layer)
      )
  );

  it.effect("accepts every reviewed immutable GitHub Action", () =>
    Effect.gen(function* () {
      expect(validateGithubActionPolicy(validActionUses())).toEqual([]);
      expect(
        yield* inspectGithubActionPolicy(REPOSITORY_ROOT).pipe(
          Effect.provide(NodeServices.layer)
        )
      ).toEqual([]);
    })
  );

  it("reports mutable, unreviewed, missing, and misconfigured actions", () => {
    const actionUses = validActionUses();
    const firstUse = actionUses[0];
    expect(firstUse).toBeDefined();
    if (!firstUse) {
      return;
    }
    actionUses[0] = { ...firstUse, reference: "actions/checkout@v7" };
    actionUses.push({
      inputs: {},
      reference: "example/unreviewed@0123456789abcdef",
      workflowPath: ".github/workflows/example.yml",
    });

    const setupIndex = actionUses.findIndex(({ reference }) =>
      reference.startsWith("pnpm/setup@")
    );
    const setupReview = GITHUB_ACTION_REVIEWS.find(
      ({ action }) => action === "pnpm/setup"
    );
    const setupUse = actionUses[setupIndex];
    expect(setupReview).toBeDefined();
    expect(setupUse).toBeDefined();
    if (!(setupReview && setupUse)) {
      return;
    }
    actionUses[setupIndex] = {
      ...setupUse,
      inputs: { cache: "unexpected", install: false },
    };
    actionUses.splice(setupIndex + 1, 1);

    const problems = validateGithubActionPolicy(actionUses);
    expect(problems.some((problem) => problem.includes("approved"))).toBe(true);
    expect(problems.some((problem) => problem.includes("unreviewed"))).toBe(
      true
    );
    expect(problems.some((problem) => problem.includes("cache"))).toBe(true);
    expect(
      problems.some((problem) =>
        problem.includes(`expected ${setupReview.expectedUsages}`)
      )
    ).toBe(true);
  });
});
