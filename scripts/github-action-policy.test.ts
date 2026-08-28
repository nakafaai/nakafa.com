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
      const treeStart = workflow.indexOf(
        "      - name: Verify merge group tree"
      );
      const trustStart = workflow.indexOf(
        "      - name: Export content environment trust"
      );

      expect(provenanceStart).toBeGreaterThan(-1);
      expect(treeStart).toBeGreaterThan(provenanceStart);
      expect(trustStart).toBeGreaterThan(treeStart);

      const provenanceStep = workflow.slice(provenanceStart, treeStart);
      const treeStep = workflow.slice(treeStart, trustStart);

      expect(workflow).not.toContain("mergeQueue");
      expect(workflow).not.toContain("github.graphql");
      expect(workflow).not.toContain("continue-on-error");
      for (const evidence of [
        "if: github.event_name == 'merge_group'",
        "const mergeGroup = context.payload.merge_group",
        "github.rest.pulls.get",
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
      ]) {
        expect(provenanceStep).toContain(evidence);
      }

      for (const evidence of [
        "if: github.event_name == 'merge_group'",
        "set -euo pipefail",
        'actual_head="$(git rev-parse HEAD)"',
        'actual_parent="$(git rev-parse "$GROUP_SHA^")"',
        'git rev-list --parents -n 1 "$GROUP_SHA" | wc -w',
        '[ "$actual_head" != "$GROUP_SHA" ]',
        '[ "$actual_parent" != "$BASE_SHA" ]',
        '[ "$parent_count" -ne 2 ]',
        'expected_tree="$(git merge-tree --write-tree "$BASE_SHA" "$PULL_HEAD")"',
        'actual_tree="$(git rev-parse "$GROUP_SHA^{tree}")"',
        'if [ "$actual_tree" != "$expected_tree" ]; then',
      ]) {
        expect(treeStep).toContain(evidence);
      }
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
