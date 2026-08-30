import { Effect, Option, Schema } from "effect";
import { parseDocument } from "yaml";

const WorkflowJobSchema = Schema.Struct({
  environment: Schema.optional(Schema.String),
  needs: Schema.optional(
    Schema.Union([Schema.String, Schema.Array(Schema.String)])
  ),
  permissions: Schema.optional(Schema.Record(Schema.String, Schema.String)),
});

const CliWorkflowSchema = Schema.Struct({
  jobs: Schema.Record(Schema.String, WorkflowJobSchema),
});

const REQUIRED_SNIPPETS = [
  "permissions: {}",
  "github.ref == 'refs/heads/main' && github.repository == 'nakafaai/nakafa.com'",
  "pnpm test:scripts",
  "pnpm --filter @nakafa/cli typecheck",
  "pnpm --filter @nakafa/cli test:coverage",
  "pnpm --filter @nakafa/cli build",
  "pnpm exec esbuild scripts/github/provenance/main.ts",
  "createRequire(import.meta.url)",
  "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
  "actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c",
  "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
  "EXPECTED_SHA256",
  "EXPECTED_SIZE",
  "EXPECTED_VERIFIER_SHA256",
  "EXPECTED_VERIFIER_SIZE",
  "NPM_CLI: npm@12.0.2",
  "ACTIONS_ID_TOKEN_REQUEST_URL",
  "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
  'npx --yes "$NPM_CLI" publish "$TARBALL" --access public --provenance',
  "npm/v1/attestations/",
  "audit signatures --json",
  "--include-attestations",
  'node "$VERIFIER"',
  '".github/workflows/cli-publish.yml"',
  '"refs/heads/main"',
] as const;

const FORBIDDEN_CREDENTIALS = [
  "NODE_AUTH_TOKEN",
  "NPM_TOKEN",
  "_authToken",
] as const;

const FORBIDDEN_PROVENANCE = [
  "@base64d",
  "bundle.dsseEnvelope.payload",
  "is_exact_provenance()",
] as const;

export class CliWorkflowPolicyError extends Schema.TaggedError<CliWorkflowPolicyError>()(
  "CliWorkflowPolicyError",
  { problems: Schema.NonEmptyArray(Schema.String) }
) {}

function decodeWorkflowJobs(source: string) {
  const document = parseDocument(source);
  if (document.errors.length > 0) {
    return Option.none();
  }
  return Schema.decodeUnknownOption(CliWorkflowSchema)(document.toJS()).pipe(
    Option.map(({ jobs }) => jobs)
  );
}

/** Returns every violation of the isolated npm trusted-publishing contract. */
export function validateCliWorkflow(source: string): string[] {
  const problems = REQUIRED_SNIPPETS.filter(
    (snippet) => !source.includes(snippet)
  ).map((snippet) => `CLI workflow is missing required contract: ${snippet}`);

  for (const snippet of FORBIDDEN_CREDENTIALS) {
    if (source.includes(snippet)) {
      problems.push(`CLI workflow contains forbidden credential: ${snippet}`);
    }
  }
  for (const snippet of FORBIDDEN_PROVENANCE) {
    if (source.includes(snippet)) {
      problems.push(
        `CLI workflow contains unauthenticated provenance parsing: ${snippet}`
      );
    }
  }

  const decodedJobs = decodeWorkflowJobs(source);
  if (Option.isNone(decodedJobs)) {
    problems.push("CLI workflow must contain a valid jobs mapping.");
    return problems;
  }

  const { build, publish } = decodedJobs.value;
  if (!(build && publish)) {
    problems.push("CLI workflow requires separate build and publish jobs.");
    return problems;
  }
  if (publish.permissions?.["id-token"] !== "write") {
    problems.push("Only the publish job must receive npm OIDC identity.");
  }
  if (publish.environment !== "npm-production") {
    problems.push(
      "CLI publication must use the protected npm-production environment."
    );
  }
  for (const [name, job] of Object.entries(decodedJobs.value)) {
    if (name !== "publish" && job.permissions?.["id-token"] !== undefined) {
      problems.push(`${name} must not receive npm OIDC identity.`);
    }
  }

  const publishNeeds = publish.needs;
  const consumesBuild =
    publishNeeds === "build" ||
    (Array.isArray(publishNeeds) && publishNeeds.includes("build"));
  if (!consumesBuild) {
    problems.push("CLI publication must consume the verified build job.");
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
