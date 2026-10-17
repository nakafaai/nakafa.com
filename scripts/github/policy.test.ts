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
    "keeps the release workflow manual, with no cache saves or Convex deploy secrets",
    () =>
      Effect.gen(function* () {
        const source = yield* readRepositoryFile(
          "../../.github/workflows/cli-publish.yml"
        );
        const workflow = yield* parseWorkflow(source);

        expect(workflow).toEqual(
          expect.objectContaining({
            on: { workflow_dispatch: null },
          })
        );
        expect(source).not.toContain("actions/cache/save@");
        expect(source).not.toContain("secrets.CONVEX_DEPLOY_KEY");
        expect(source).not.toContain("secrets.CONTENT_RUNTIME_CACHE_KEY");
      }).pipe(Effect.provide(NodeServices.layer))
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

  it("accepts a local action below .github/actions and reports one anywhere else", () => {
    const problems = validateGithubActionPolicy(
      Arr.appendAll(validActionUses(), [
        {
          inputs: {},
          reference: "./.github/actions/install",
          workflowPath: ".github/workflows/example.yml",
        },
        {
          inputs: {},
          reference: "./.github/tools/install",
          workflowPath: ".github/workflows/example.yml",
        },
      ])
    );

    expect(problems).toEqual([
      ".github/workflows/example.yml uses the local action ./.github/tools/install; keep a local action below .github/actions, where this policy reads the actions it uses.",
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
