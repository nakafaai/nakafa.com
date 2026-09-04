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
              pull_request: expect.any(Object),
            }),
          })
        );
        expect(workflow).not.toEqual(
          expect.objectContaining({
            on: expect.objectContaining({ merge_group: expect.anything() }),
          })
        );
        expect(workflow).not.toEqual(
          expect.objectContaining({
            on: expect.objectContaining({ push: expect.anything() }),
          })
        );
        expect(source).not.toContain("actions/cache/save@");

        const snapshotSource = yield* readRepositoryFile(
          "../../.github/workflows/snapshot.yml"
        );
        const snapshotWorkflow = yield* parseWorkflow(snapshotSource);
        expect(snapshotWorkflow).toEqual(
          expect.objectContaining({
            concurrency: {
              "cancel-in-progress": false,
              group: "snapshot",
            },
            jobs: {
              publish: expect.objectContaining({
                if: expect.stringContaining(
                  "github.event.deployment_status.state == 'success'"
                ),
                name: "Publish",
                steps: expect.arrayContaining([
                  expect.objectContaining({
                    name: "Verify current main deployment",
                  }),
                  expect.objectContaining({
                    name: "Export snapshot",
                    run: "pnpm --silent --dir packages/backend runtime:ci export",
                  }),
                  {
                    env: expect.objectContaining({
                      CONVEX_DEPLOY_KEY: expect.any(String),
                    }),
                    name: "Verify selection",
                    run: "pnpm --silent --dir packages/backend runtime:ci verify-generations",
                  },
                ]),
              }),
            },
            on: {
              deployment_status: {},
              workflow_dispatch: {},
            },
          })
        );
        expect(snapshotWorkflow).not.toEqual(
          expect.objectContaining({
            on: expect.objectContaining({ merge_group: expect.anything() }),
          })
        );
        expect(snapshotWorkflow).not.toEqual(
          expect.objectContaining({
            on: expect.objectContaining({ pull_request: expect.anything() }),
          })
        );
        expect(snapshotWorkflow).not.toEqual(
          expect.objectContaining({
            on: expect.objectContaining({ push: expect.anything() }),
          })
        );
        expect(snapshotSource).toContain("Production – www");
        expect(snapshotSource).not.toContain("actions/cache/");
        expect(snapshotSource).toContain(
          "This release contains exactly one current encrypted signed snapshot."
        );
        expect(source).toContain(
          "schema-changing candidate needs one production export"
        );
        expect(source).not.toContain("codex/snapshot");
        expect(source.match(/runtime:ci export/gu)).toHaveLength(1);
      }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("runs every required check on the current pull-request head", () =>
    readRepositoryFile("../../.github/workflows/ci.yml").pipe(
      Effect.tap((source) =>
        Effect.sync(() => {
          expect(source).toContain(
            'pnpm run doctor --verbose --scope changed --base "$DOCTOR_BASE"'
          );
          expect(source).toContain(
            `required: \${{ steps.classify.outputs.required == 'true' || (steps.classify.outputs.required == '' && steps.default.outputs.required == 'true') }}`
          );
          expect(source).toContain("          REQUIRED: true");
          expect(source).not.toContain("actions/github-script");
          expect(source).not.toContain("merge_group");
          expect(source).not.toContain("pnpm ci:queue");
          expect(source).not.toContain("pnpm ci:review");
          expect(source).not.toContain("outputs.reuse");
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
