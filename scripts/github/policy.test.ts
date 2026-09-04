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
const CONTENT_RUNTIME_CACHE_KEY_PATTERN =
  /^runtime-content-\$\{\{ env\.CONTENT_RUNTIME_STATE_HASH \}\}-\$\{\{ env\.CONTENT_RUNTIME_SCHEMA_HASH \}\}$/u;
const CONTENT_RUNTIME_CACHE_PRIMARY_KEY_PATTERN =
  /^\$\{\{ steps\.signed-content-cache\.outputs\.cache-primary-key \}\}$/u;

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
    "runs candidate validation before merge and isolates snapshot publishing",
    () =>
      Effect.gen(function* () {
        const source = yield* readRepositoryFile(
          "../../.github/workflows/ci.yml"
        );
        const workflow = yield* parseWorkflow(source);

        expect(workflow).toEqual(
          expect.objectContaining({
            jobs: expect.objectContaining({
              doctor: expect.objectContaining({ name: "Doctor" }),
              required: expect.objectContaining({ name: "Required" }),
              scope: expect.objectContaining({ name: "Scope" }),
            }),
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
        expect(source).not.toContain("actions/cache/save@");

        const cacheSource = yield* readRepositoryFile(
          "../../.github/workflows/cache.yml"
        );
        const cacheWorkflow = yield* parseWorkflow(cacheSource);
        expect(cacheWorkflow).toEqual(
          expect.objectContaining({
            concurrency: {
              "cancel-in-progress": false,
              group: "content-snapshot-cache-main",
            },
            jobs: {
              publish: expect.objectContaining({
                if: "github.ref == 'refs/heads/main' && github.repository == 'nakafaai/nakafa.com'",
                name: "Publish",
                steps: expect.arrayContaining([
                  expect.objectContaining({
                    id: "signed-content-cache",
                    uses: "actions/cache/restore@55cc8345863c7cc4c66a329aec7e433d2d1c52a9",
                    with: expect.objectContaining({
                      key: expect.stringMatching(
                        CONTENT_RUNTIME_CACHE_KEY_PATTERN
                      ),
                    }),
                  }),
                  expect.objectContaining({
                    name: "Save encrypted signed content snapshot",
                    uses: "actions/cache/save@55cc8345863c7cc4c66a329aec7e433d2d1c52a9",
                    with: expect.objectContaining({
                      key: expect.stringMatching(
                        CONTENT_RUNTIME_CACHE_PRIMARY_KEY_PATTERN
                      ),
                    }),
                  }),
                ]),
              }),
            },
            on: {
              push: { branches: ["main"] },
              workflow_dispatch: {},
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
      readRepositoryFile("../../.github/workflows/ci.yml").pipe(
        Effect.tap((source) =>
          Effect.sync(() => {
            expect(source).toContain(
              'pnpm run doctor --verbose --scope changed --base "$DOCTOR_BASE"'
            );
            expect(source).toContain(
              "pnpm run doctor --verbose --scope full --blocking warning"
            );
            expect(source).toContain("run: pnpm ci:queue");
            expect(source).toContain("run: pnpm ci:review");
            expect(source).toContain(
              `required: \${{ github.event_name == 'merge_group' || steps.classify.outputs.required == 'true' || (steps.classify.outputs.required == '' && steps.default.outputs.required == 'true') }}`
            );
            expect(source).toContain("run: pnpm security:audit");
            expect(source).toContain("if: needs.scope.outputs.reuse != 'true'");
            expect(source).not.toContain("actions/github-script");
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
