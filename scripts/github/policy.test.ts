import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import {
  Array as Arr,
  Effect,
  FileSystem,
  Option,
  Record as Rec,
} from "effect";
import { parse as yamlParse } from "yaml";
import {
  GITHUB_ACTION_REVIEWS,
  type GithubActionUse,
  inspectGithubActionPolicy,
  readWorkflowActionUses,
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

/** Creates a repository root whose workflow directory holds the given files. */
const makeWorkflows = Effect.fn("GithubPolicyTest.makeWorkflows")(function* (
  files: Record<string, string>
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const root = yield* fileSystem.makeTempDirectoryScoped({
    prefix: "github-policy-",
  });
  yield* fileSystem.makeDirectory(`${root}/.github/workflows`, {
    recursive: true,
  });
  for (const [file, content] of Rec.toEntries(files)) {
    yield* fileSystem.writeFileString(
      `${root}/.github/workflows/${file}`,
      content
    );
  }
  return root;
});

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
                  expect.objectContaining({ run: "pnpm acceptance:prepare" }),
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
        // Only prepare generates the Convex bindings; the root build and start
        // scripts would regenerate them twice more.
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

  it.effect("reads external action uses from every workflow file", () =>
    Effect.gen(function* () {
      const root = yield* makeWorkflows({
        "README.md": "uses: example/ignored@0123456789abcdef\n",
        "ci.yml": Arr.join(
          [
            "jobs:",
            "  build:",
            "    steps:",
            "      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
            "      - uses: ./.github/actions/local",
            "      - uses: pnpm/setup@84cb39b217b10273981911c288cd62326dc7c6d2",
            "        with:",
            "          cache: true",
            "",
          ],
          "\n"
        ),
        "release.yaml":
          "jobs:\n  release:\n    uses: example/reusable/.github/workflows/release.yml@main\n",
      });

      expect(yield* readWorkflowActionUses(root)).toEqual([
        {
          inputs: {},
          reference:
            "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
          workflowPath: ".github/workflows/ci.yml",
        },
        {
          inputs: { cache: true },
          reference: "pnpm/setup@84cb39b217b10273981911c288cd62326dc7c6d2",
          workflowPath: ".github/workflows/ci.yml",
        },
        {
          inputs: {},
          reference: "example/reusable/.github/workflows/release.yml@main",
          workflowPath: ".github/workflows/release.yaml",
        },
      ]);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("reports workflows it cannot read or decode", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const missing = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "github-policy-missing-",
      });
      const unreadable = yield* makeWorkflows({});
      yield* fileSystem.makeDirectory(
        `${unreadable}/.github/workflows/broken.yml`
      );
      const invalid = yield* makeWorkflows({ "invalid.yml": "jobs: [\n" });

      const problems = yield* Effect.forEach(
        [missing, unreadable, invalid],
        inspectGithubActionPolicy
      );
      expect(Arr.flatten(problems)).toEqual([
        "Unable to inspect GitHub Actions: Unable to read GitHub workflow files.",
        "Unable to inspect GitHub Actions: Unable to read .github/workflows/broken.yml.",
        "Unable to inspect GitHub Actions: Unable to decode .github/workflows/invalid.yml.",
      ]);
    }).pipe(Effect.provide(NodeServices.layer))
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
    const candidateUses = Arr.remove(
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
      setupIndex + 1
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
