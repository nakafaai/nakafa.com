import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, FileSystem, Option } from "effect";
import { parse as yamlParse } from "yaml";
import {
  GITHUB_ACTION_REVIEWS,
  type GithubActionUse,
  validateGithubActionPolicy,
} from "#scripts/github/policy";
import { inspectGithubActionPolicy } from "#scripts/github/source";

const REPOSITORY_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PLAYWRIGHT_SUITE_ENVIRONMENT =
  /PLAYWRIGHT_SUITE: \$\{\{ matrix\.suite \}\}/u;
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
      try: (): unknown => yamlParse(source),
      catch: (cause) => String(cause),
    })
);

function validActionUses(): GithubActionUse[] {
  return Arr.flatMap(GITHUB_ACTION_REVIEWS, (review) =>
    Array.from({ length: review.expectedUsages }, (_, index) => ({
      inputs: review.expectedInputs ?? {},
      reference: `${review.action}@${review.approvedSha}`,
      workflowPath: `.github/workflows/example-${index}.yml`,
    }))
  );
}

describe("GitHub Action policy", () => {
  it.effect(
    "runs candidate validation with a signed isolated acceptance publication",
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
              merge_group: {
                branches: ["main"],
                types: ["checks_requested"],
              },
              // Edits never rerun CI, and stacked pull requests run on their
              // own base before GitHub retargets them to main.
              pull_request: {
                types: [
                  "opened",
                  "synchronize",
                  "reopened",
                  "ready_for_review",
                ],
              },
            }),
          })
        );
        expect(workflow).not.toEqual(
          expect.objectContaining({
            on: expect.objectContaining({ push: expect.anything() }),
          })
        );
        expect(source).not.toContain("actions/cache/save@");

        expect(workflow).toEqual(
          expect.objectContaining({
            jobs: expect.objectContaining({
              production: expect.objectContaining({
                steps: expect.arrayContaining([
                  expect.objectContaining({
                    run: "pnpm --dir packages/backend acceptance prepare",
                  }),
                  expect.objectContaining({
                    run: "pnpm --dir packages/backend acceptance build",
                  }),
                  expect.objectContaining({
                    run: "pnpm --filter www test:browser",
                  }),
                ]),
              }),
            }),
          })
        );
        // Only prepare generates the Convex bindings; the acceptance:build and
        // acceptance:start scripts would regenerate them again.
        expect(source).not.toContain("pnpm acceptance:build");
        expect(source).not.toContain("pnpm acceptance:start");
        expect(source).toContain(
          "setsid pnpm --dir packages/backend acceptance start"
        );
        expect(source).not.toContain("secrets.CONVEX_DEPLOY_KEY");
        expect(source).not.toContain("secrets.CONTENT_RUNTIME_CACHE_KEY");
        expect(source).toContain("pnpm acceptance:clean");
        expect(source).not.toContain("runtime:ci export");
      }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect(
    "checks the Convex bindings after the Quality typecheck, with no explicit codegen step",
    () =>
      readRepositoryFile("../../.github/workflows/ci.yml").pipe(
        Effect.tap((source) =>
          Effect.sync(() => {
            const typecheck = source.indexOf("      - name: Typecheck\n");
            const verify = source.indexOf(
              "      - name: Verify generated backend contracts\n"
            );
            const tests = source.indexOf("      - name: Run tests\n");
            expect(typecheck).toBeGreaterThan(-1);
            expect(verify).toBeGreaterThan(typecheck);
            expect(tests).toBeGreaterThan(verify);
            expect(source).not.toContain("pnpm --filter @repo/backend codegen");
          })
        ),
        Effect.provide(NodeServices.layer)
      )
  );

  it.effect(
    "runs the backend suite in its own job and gates Required on it",
    () =>
      Effect.gen(function* () {
        const source = yield* readRepositoryFile(
          "../../.github/workflows/ci.yml"
        );
        const workflow = yield* parseWorkflow(source);

        expect(workflow).toEqual(
          expect.objectContaining({
            jobs: expect.objectContaining({
              backend: expect.objectContaining({
                name: "Backend",
                steps: expect.arrayContaining([
                  expect.objectContaining({
                    run: "pnpm --dir packages/backend test",
                  }),
                ]),
              }),
              required: expect.objectContaining({
                needs: ["scope", "quality", "backend", "production", "doctor"],
              }),
            }),
          })
        );
        expect(source).toContain(
          "pnpm exec turbo run test --filter='!@repo/backend'"
        );
        // A workspace filter exits 0 without running anything when the backend
        // has no test script, so the backend job runs its package script.
        expect(source).not.toContain("turbo run test --filter=@repo/backend");
      }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("runs one production leg per browser suite", () =>
    Effect.gen(function* () {
      const source = yield* readRepositoryFile(
        "../../.github/workflows/ci.yml"
      );
      const workflow = yield* parseWorkflow(source);

      expect(workflow).toEqual(
        expect.objectContaining({
          jobs: expect.objectContaining({
            production: expect.objectContaining({
              name: "Production",
              strategy: {
                "fail-fast": false,
                matrix: { suite: ["runtime", "visual", "navigation"] },
              },
            }),
          }),
        })
      );
      expect(source).toMatch(PLAYWRIGHT_SUITE_ENVIRONMENT);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("runs every required check on each candidate head", () =>
    readRepositoryFile("../../.github/workflows/ci.yml").pipe(
      Effect.tap((source) =>
        Effect.sync(() => {
          expect(source).toContain(
            'pnpm run doctor --verbose --scope changed --base "$DOCTOR_BASE"'
          );
          expect(source).toContain(
            `DOCTOR_BASE: \${{ github.event.merge_group.base_sha || 'origin/main' }}`
          );
          expect(source).toContain(
            `required: \${{ steps.classify.outputs.required == 'true' || (steps.classify.outputs.required == '' && steps.default.outputs.required == 'true') }}`
          );
          expect(source).toContain("          REQUIRED: true");
          expect(source).toContain(
            `cancel-in-progress: \${{ github.event_name == 'pull_request' }}`
          );
          expect(source).not.toContain("actions/github-script");
          expect(source).not.toContain("pnpm ci:queue");
          expect(source).not.toContain("pnpm ci:review");
          expect(source).not.toContain("outputs.reuse");
        })
      ),
      Effect.provide(NodeServices.layer)
    )
  );

  it.effect(
    "trusts only the owner's pull requests and the merge groups the owner enqueued",
    () =>
      readRepositoryFile("../../.github/workflows/ci.yml").pipe(
        Effect.tap((source) =>
          Effect.sync(() => {
            expect(source).toContain(
              `TRUSTED_CANDIDATE: \${{ (github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository && github.event.pull_request.user.login == 'nabilfatih' && github.actor == 'nabilfatih') || (github.event_name == 'merge_group' && github.event.merge_group.base_ref == 'refs/heads/main' && github.actor == 'nabilfatih') }}`
            );
            expect(source).toContain(
              `ref: \${{ env.TRUSTED_CANDIDATE == 'true' && github.sha || github.event.pull_request.base.sha || github.event.merge_group.base_sha }}`
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

  it("reports unpinned references, missing inputs, and unused reviews", () => {
    const actionUses = Arr.filter(
      validActionUses(),
      ({ reference }) => !reference.startsWith("actions/download-artifact@")
    );
    const setupIndex = Option.getOrElse(
      Arr.findFirstIndex(actionUses, ({ reference }) =>
        reference.startsWith("pnpm/setup@")
      ),
      () => -1
    );
    const { cache, ...reviewedInputs } =
      Option.getOrUndefined(
        Arr.findFirst(
          GITHUB_ACTION_REVIEWS,
          ({ action }) => action === "pnpm/setup"
        )
      )?.expectedInputs ?? {};
    const setupUse = actionUses[setupIndex];
    expect(setupUse).toBeDefined();
    if (!setupUse) {
      return;
    }
    const candidateUses = Arr.appendAll(
      Arr.map(actionUses, (use, index) =>
        index === setupIndex ? { ...setupUse, inputs: reviewedInputs } : use
      ),
      [
        {
          inputs: {},
          reference: "actions/checkout",
          workflowPath: ".github/workflows/example.yml",
        },
        {
          inputs: {},
          reference: "actions/checkout@",
          workflowPath: ".github/workflows/example.yml",
        },
      ]
    );

    expect(validateGithubActionPolicy(candidateUses)).toEqual([
      `${setupUse.workflowPath} configures pnpm/setup cache as missing; approved ${cache}.`,
      ".github/workflows/example.yml has an unpinned external action actions/checkout.",
      ".github/workflows/example.yml has an unpinned external action actions/checkout@.",
      "actions/download-artifact has 0 workflow usages; expected 3.",
    ]);
  });

  it("reports mutable, unreviewed, missing, and misconfigured actions", () => {
    const validUses = validActionUses();
    const firstUse = validUses[0];
    expect(firstUse).toBeDefined();
    if (!firstUse) {
      return;
    }
    const actionUses = Arr.append(
      Arr.map(validUses, (use, index) =>
        index === 0 ? { ...firstUse, reference: "actions/checkout@v7" } : use
      ),
      {
        inputs: {},
        reference: "example/unreviewed@0123456789abcdef",
        workflowPath: ".github/workflows/example.yml",
      }
    );

    const setupIndex = Option.getOrElse(
      Arr.findFirstIndex(actionUses, ({ reference }) =>
        reference.startsWith("pnpm/setup@")
      ),
      () => -1
    );
    const setupReview = Option.getOrUndefined(
      Arr.findFirst(
        GITHUB_ACTION_REVIEWS,
        ({ action }) => action === "pnpm/setup"
      )
    );
    const setupUse = actionUses[setupIndex];
    expect(setupReview).toBeDefined();
    expect(setupUse).toBeDefined();
    if (!(setupReview && setupUse)) {
      return;
    }
    // The setup review allows one use, so a second use breaks its count.
    const candidateUses = Arr.append(
      Arr.map(actionUses, (use, index) =>
        index === setupIndex
          ? {
              ...setupUse,
              inputs: {
                cache: true,
                install: false,
                "node-version-file": ".nvmrc",
              },
            }
          : use
      ),
      setupUse
    );

    const problems = validateGithubActionPolicy(candidateUses);
    expect(Arr.some(problems, (problem) => problem.includes("approved"))).toBe(
      true
    );
    expect(problems).toEqual(
      expect.arrayContaining([
        ".github/workflows/example.yml uses unreviewed GitHub Action example/unreviewed.",
        `${setupUse.workflowPath} configures pnpm/setup cache as true; approved false.`,
        `${setupUse.workflowPath} configures unreviewed pnpm/setup input node-version-file.`,
      ])
    );
    expect(
      Arr.some(problems, (problem) =>
        problem.includes(`expected ${setupReview.expectedUsages}`)
      )
    ).toBe(true);
  });
});
