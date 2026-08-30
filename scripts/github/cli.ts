import { Effect, Schema } from "effect";

const REQUIRED_SNIPPETS = [
  "permissions: {}",
  "github.ref == 'refs/heads/main' && github.repository == 'nakafaai/nakafa.com'",
  "pnpm --filter @nakafa/cli typecheck",
  "pnpm --filter @nakafa/cli test:coverage",
  "pnpm --filter @nakafa/cli build",
  "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
  "actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c",
  "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
  "environment: npm-production",
  "EXPECTED_SHA256",
  "EXPECTED_SIZE",
  "NPM_CLI: npm@12.0.2",
  "ACTIONS_ID_TOKEN_REQUEST_URL",
  "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
  'npx --yes "$NPM_CLI" publish "$TARBALL" --access public --provenance',
  "npm/v1/attestations/",
  "audit signatures --json",
  "--include-attestations",
  "(.invalid | length) != 0 or (.missing | length) != 0",
  '== ".github/workflows/cli-publish.yml"',
  '== "refs/heads/main"',
  ".digest.gitCommit == $sha",
] as const;

const FORBIDDEN_SNIPPETS = [
  "NODE_AUTH_TOKEN",
  "NPM_TOKEN",
  "_authToken",
] as const;

export class CliWorkflowPolicyError extends Schema.TaggedError<CliWorkflowPolicyError>()(
  "CliWorkflowPolicyError",
  { problems: Schema.NonEmptyArray(Schema.String) }
) {}

/** Returns every violation of the isolated npm trusted-publishing contract. */
export function validateCliWorkflow(source: string): string[] {
  const problems = REQUIRED_SNIPPETS.filter(
    (snippet) => !source.includes(snippet)
  ).map((snippet) => `CLI workflow is missing required contract: ${snippet}`);

  for (const snippet of FORBIDDEN_SNIPPETS) {
    if (source.includes(snippet)) {
      problems.push(`CLI workflow contains forbidden credential: ${snippet}`);
    }
  }

  if ((source.match(/id-token: write/gu) ?? []).length !== 1) {
    problems.push("Exactly one isolated job must receive npm OIDC identity.");
  }

  const buildIndex = source.indexOf("\n  build:");
  const publishIndex = source.indexOf("\n  publish:");
  if (buildIndex < 0 || publishIndex <= buildIndex) {
    problems.push(
      "CLI verification must complete before isolated publication."
    );
  } else {
    const buildJob = source.slice(buildIndex, publishIndex);
    const publishJob = source.slice(publishIndex);
    if (buildJob.includes("id-token: write")) {
      problems.push("CLI verification must not receive npm OIDC identity.");
    }
    if (!publishJob.includes("needs: build")) {
      problems.push("CLI publication must consume the verified build job.");
    }
  }

  return problems;
}

/** Verifies the complete Effect-owned CLI workflow policy. */
export const verifyCliWorkflow = Effect.fn("GithubCli.verify")(function* (
  source: string
) {
  const problems = validateCliWorkflow(source);
  const [first, ...rest] = problems;
  if (first) {
    return yield* new CliWorkflowPolicyError({
      problems: [first, ...rest],
    });
  }
});
