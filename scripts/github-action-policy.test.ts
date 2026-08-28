import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Result } from "effect";
import {
  HttpClient,
  type HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http";
import { parse as yamlParse } from "yaml";
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
  it("runs candidate validation before merge without repeating it on main", () => {
    for (const fileName of ["agent-docs.yml", "react-doctor.yml"]) {
      const source = readFileSync(
        fileURLToPath(
          new URL(`../.github/workflows/${fileName}`, import.meta.url)
        ),
        "utf8"
      );
      const workflow: unknown = yamlParse(source);

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

    const cacheSource = readFileSync(
      fileURLToPath(
        new URL(
          "../.github/workflows/content-snapshot-cache.yml",
          import.meta.url
        )
      ),
      "utf8"
    );
    const cacheWorkflow: unknown = yamlParse(cacheSource);
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
  });

  it("runs changed React checks on pull requests and full checks in the queue", () => {
    const source = readFileSync(
      fileURLToPath(
        new URL("../.github/workflows/react-doctor.yml", import.meta.url)
      ),
      "utf8"
    );
    expect(source).toContain(
      'pnpm run doctor --verbose --scope changed --base "$DOCTOR_BASE"'
    );
    expect(source).toContain(
      "pnpm run doctor --verbose --scope full --blocking warning"
    );
  });

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
