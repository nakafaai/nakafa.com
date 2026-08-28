import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Result } from "effect";
import {
  HttpClient,
  type HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http";
import {
  fetchLatestGithubActionTag,
  GITHUB_ACTION_REVIEWS,
  type GithubActionUse,
  inspectGithubActionPolicy,
  validateGithubActionPolicy,
} from "./github-action-policy.ts";

const REPOSITORY_ROOT = fileURLToPath(new URL("..", import.meta.url));
const BASE_BRANCH_INTERPOLATION = ["$", "{baseBranch}"].join("");

function actionExpression(expression: string) {
  return ["$", "{{ ", expression, " }}"].join("");
}

function validActionUses(): GithubActionUse[] {
  return GITHUB_ACTION_REVIEWS.flatMap((review) =>
    Array.from({ length: review.expectedUsages }, (_, index) => ({
      inputs: review.expectedInputs ?? {},
      reference: `${review.action}@${review.approvedSha}`,
      workflowPath: `.github/workflows/example-${index}.yml`,
    }))
  );
}

function makeHttpClient(
  makeResponse: (request: HttpClientRequest.HttpClientRequest) => Response
) {
  return Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) =>
      Effect.sync(() =>
        HttpClientResponse.fromWeb(request, makeResponse(request))
      )
    )
  );
}

describe("GitHub Action policy", () => {
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

  it.effect("keeps merge-group trust on accessible exact evidence", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const workflow = yield* fileSystem.readFileString(
        `${REPOSITORY_ROOT}/.github/workflows/agent-docs.yml`
      );
      const provenanceStart = workflow.indexOf(
        "      - name: Verify merge group provenance"
      );
      const scopeStart = workflow.indexOf("  production-scope:\n");
      const treeStart = workflow.indexOf(
        "      - name: Verify merge group tree"
      );
      const trustStart = workflow.indexOf(
        "      - name: Export content environment trust"
      );
      const setupStart = workflow.indexOf(
        "      - name: Setup toolchain",
        trustStart
      );
      const installStart = workflow.indexOf(
        "      - name: Install dependencies",
        setupStart
      );
      const classifyStart = workflow.indexOf(
        "      - name: Classify production acceptance",
        installStart
      );
      const qualityStart = workflow.indexOf("\n  quality:", classifyStart);
      const productionStart = workflow.indexOf("\n  production:", qualityStart);
      const requiredStart = workflow.indexOf(
        "\n  agent-docs:",
        productionStart
      );

      expect(scopeStart).toBeGreaterThan(-1);
      expect(provenanceStart).toBeGreaterThan(scopeStart);
      expect(treeStart).toBeGreaterThan(provenanceStart);
      expect(trustStart).toBeGreaterThan(treeStart);
      expect(setupStart).toBeGreaterThan(trustStart);
      expect(installStart).toBeGreaterThan(setupStart);
      expect(classifyStart).toBeGreaterThan(installStart);
      expect(qualityStart).toBeGreaterThan(classifyStart);
      expect(productionStart).toBeGreaterThan(qualityStart);
      expect(requiredStart).toBeGreaterThan(productionStart);

      const scopeJob = workflow.slice(scopeStart, qualityStart);
      const workflowPreamble = workflow.slice(0, scopeStart);
      const checkoutStep = workflow.slice(scopeStart, provenanceStart);
      const provenanceStep = workflow.slice(provenanceStart, treeStart);
      const treeStep = workflow.slice(treeStart, trustStart);
      const trustStep = workflow.slice(trustStart, setupStart);
      const setupStep = workflow.slice(setupStart, installStart);
      const installStep = workflow.slice(installStart, classifyStart);
      const classifyStep = workflow.slice(classifyStart, qualityStart);
      const productionJob = workflow.slice(productionStart, requiredStart);

      expect(workflow).not.toContain("mergeQueue");
      expect(workflow).not.toContain("github.graphql");
      expect(workflow).not.toContain("continue-on-error");
      for (const evidence of [
        "  merge_group:\n    branches: [main]\n    types: [checks_requested]",
        "  push:\n    branches: [main]",
        "permissions:\n  contents: read\n  pull-requests: read\n\nconcurrency:",
        `group: Agent-Friendly Docs-${actionExpression("github.event_name == 'pull_request' && github.event.pull_request.number || github.sha")}`,
        `cancel-in-progress: ${actionExpression("github.event_name == 'pull_request'")}`,
      ]) {
        expect(workflowPreamble).toContain(evidence);
        expect(workflowPreamble.indexOf(evidence)).toBe(
          workflowPreamble.lastIndexOf(evidence)
        );
      }
      expect(checkoutStep.match(/^ {6}- if:.*$/gm)).toEqual([
        "      - if: env.DIRECT_TRUSTED_CONTENT_ENVIRONMENT == 'true' || github.event_name == 'merge_group'",
      ]);
      for (const evidence of [
        "id: default",
        "uses: actions/checkout@",
        "fetch-depth: 0",
        'echo "required=$REQUIRED" >> "$GITHUB_OUTPUT"',
      ]) {
        expect(checkoutStep).toContain(evidence);
        expect(checkoutStep.indexOf(evidence)).toBe(
          checkoutStep.lastIndexOf(evidence)
        );
      }
      for (const evidence of [
        "if: github.event_name == 'merge_group'",
        "id: merge-group-provenance",
        "result-encoding: string",
        "const mergeGroup = context.payload.merge_group",
        "const baseBranch = mergeGroup.base_ref.replace(",
        'const groupRef = mergeGroup.head_ref.startsWith("refs/heads/")',
        `const queuePrefix = \`refs/heads/gh-readonly-queue/${BASE_BRANCH_INTERPOLATION}/pr-\``,
        ".slice(queuePrefix.length)",
        "!groupRef.startsWith(queuePrefix)",
        "!/^[1-9][0-9]*$/.test(pullNumber)",
        "unexpected.length > 0",
        "refBaseSha !== mergeGroup.base_sha",
        "mergeGroup.head_sha !== context.sha",
        "github.rest.pulls.get",
        "pull_number: Number(pullNumber)",
        'const trustedOwner = "nabilfatih"',
        'pull.state !== "open"',
        "groupRef !== process.env.GITHUB_REF",
        "pull.base.ref !== baseBranch",
        "pull.base.repo.full_name !== context.payload.repository.full_name",
        "pull.head.repo?.full_name !== context.payload.repository.full_name",
        "pull.user?.login !== trustedOwner ||",
        "const actor = context.payload.sender?.login",
        "actor !== trustedOwner ||",
        "context.actor !== trustedOwner",
        'core.setOutput("pull-head", pull.head.sha)',
        'return "true"',
      ]) {
        expect(provenanceStep).toContain(evidence);
        expect(provenanceStep.indexOf(evidence)).toBe(
          provenanceStep.lastIndexOf(evidence)
        );
      }
      expect(provenanceStep.match(/throw new Error/g)).toHaveLength(3);

      for (const evidence of [
        "if: github.event_name == 'merge_group'",
        `BASE_SHA: ${actionExpression("github.event.merge_group.base_sha")}`,
        `GROUP_SHA: ${actionExpression("github.event.merge_group.head_sha")}`,
        `PULL_HEAD: ${actionExpression("steps.merge-group-provenance.outputs.pull-head")}`,
        "set -euo pipefail",
        'git fetch --no-tags origin "$BASE_SHA" "$GROUP_SHA" "$PULL_HEAD"',
        'actual_head="$(git rev-parse HEAD)"',
        'actual_parent="$(git rev-parse "$GROUP_SHA^")"',
        'parent_count="$(git rev-list --parents -n 1 "$GROUP_SHA" | wc -w)"',
        '[ "$actual_head" != "$GROUP_SHA" ]',
        '[ "$actual_parent" != "$BASE_SHA" ]',
        '[ "$parent_count" -ne 2 ]',
        'expected_tree="$(git merge-tree --write-tree "$BASE_SHA" "$PULL_HEAD")"',
        'actual_tree="$(git rev-parse "$GROUP_SHA^{tree}")"',
        'if [ "$actual_tree" != "$expected_tree" ]; then',
      ]) {
        expect(treeStep).toContain(evidence);
        expect(treeStep.indexOf(evidence)).toBe(treeStep.lastIndexOf(evidence));
      }
      expect(treeStep.match(/^\s+exit 1$/gm)).toHaveLength(2);

      for (const evidence of [
        "id: trust",
        `DIRECT_TRUST: ${actionExpression("env.DIRECT_TRUSTED_CONTENT_ENVIRONMENT")}`,
        `MERGE_GROUP_TRUST: ${actionExpression("steps.merge-group-provenance.outputs.result")}`,
        "trusted=false",
        'if [ "$DIRECT_TRUST" = "true" ] || [ "$MERGE_GROUP_TRUST" = "true" ]; then',
        "trusted=true",
        'echo "trusted=$trusted" >> "$GITHUB_OUTPUT"',
      ]) {
        expect(trustStep).toContain(evidence);
        expect(trustStep.indexOf(evidence)).toBe(
          trustStep.lastIndexOf(evidence)
        );
      }
      expect(trustStep).toContain(
        [
          "          trusted=false",
          '          if [ "$DIRECT_TRUST" = "true" ] || [ "$MERGE_GROUP_TRUST" = "true" ]; then',
          "            trusted=true",
          "          fi",
          '          echo "trusted=$trusted" >> "$GITHUB_OUTPUT"',
        ].join("\n")
      );

      for (const guardedStep of [setupStep, installStep]) {
        expect(guardedStep.match(/^ {8}if:.*$/gm)).toEqual([
          "        if: steps.trust.outputs.trusted == 'true'",
        ]);
      }

      for (const evidence of [
        "id: classify",
        "if: steps.trust.outputs.trusted == 'true'",
        `BASE_SHA: ${actionExpression("github.event_name == 'pull_request' && github.event.pull_request.base.sha || github.event_name == 'merge_group' && github.event.merge_group.base_sha || github.event.before")}`,
        `HEAD_SHA: ${actionExpression("github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.event_name == 'merge_group' && github.event.merge_group.head_sha || github.sha")}`,
        "run: pnpm ci:production-acceptance",
      ]) {
        expect(classifyStep).toContain(evidence);
        expect(classifyStep.indexOf(evidence)).toBe(
          classifyStep.lastIndexOf(evidence)
        );
      }

      for (const evidence of [
        `DIRECT_TRUSTED_CONTENT_ENVIRONMENT: ${actionExpression("github.event_name == 'push' || (github.event.pull_request.head.repo.full_name == github.repository && github.event.pull_request.user.login == 'nabilfatih' && github.actor == 'nabilfatih')")}`,
        `required: ${actionExpression("steps.classify.outputs.required || steps.default.outputs.required")}`,
        `trusted: ${actionExpression("steps.trust.outputs.trusted")}`,
      ]) {
        expect(scopeJob).toContain(evidence);
        expect(scopeJob.indexOf(evidence)).toBe(scopeJob.lastIndexOf(evidence));
      }

      expect(productionJob.match(/^ {4}if:.*$/gm)).toEqual([
        "    if: needs.production-scope.outputs.required == 'true' && needs.production-scope.outputs.trusted == 'true'",
      ]);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("reads release metadata through the Effect HTTP client", () =>
    Effect.gen(function* () {
      let observedRequest: HttpClientRequest.HttpClientRequest | undefined;
      const releaseTag = yield* fetchLatestGithubActionTag({
        repository: "actions/checkout",
      }).pipe(
        Effect.provide(
          makeHttpClient((request) => {
            observedRequest = request;
            return Response.json({ tag_name: "v7.0.1" });
          })
        )
      );

      expect(releaseTag).toBe("v7.0.1");
      expect(observedRequest?.url).toBe(
        "https://api.github.com/repos/actions/checkout/releases/latest"
      );
    })
  );

  it.effect("rejects unavailable GitHub release metadata", () =>
    Effect.gen(function* () {
      const result = yield* fetchLatestGithubActionTag({
        repository: "actions/checkout",
      }).pipe(
        Effect.provide(
          makeHttpClient(() => new Response(null, { status: 403 }))
        ),
        Effect.result
      );

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isSuccess(result)) {
        return;
      }
      expect(result.failure).toMatchObject({
        _tag: "GithubActionReleaseError",
        message: "Unable to read the latest actions/checkout release.",
      });
    })
  );
});
