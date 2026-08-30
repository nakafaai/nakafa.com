import { Effect, Option, Schema } from "effect";
import { parseDocument } from "yaml";

const WorkflowStepSchema = Schema.Struct({
  env: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  name: Schema.optional(Schema.String),
  run: Schema.optional(Schema.String),
  uses: Schema.optional(Schema.String),
  with: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
});

const WorkflowJobSchema = Schema.Struct({
  environment: Schema.optional(Schema.String),
  if: Schema.optional(Schema.String),
  needs: Schema.optional(
    Schema.Union([Schema.String, Schema.Array(Schema.String)])
  ),
  outputs: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  permissions: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  steps: Schema.Array(WorkflowStepSchema),
});

const CliWorkflowSchema = Schema.Struct({
  jobs: Schema.Record(Schema.String, WorkflowJobSchema),
  permissions: Schema.Record(Schema.String, Schema.String),
});

type WorkflowJob = Schema.Schema.Type<typeof WorkflowJobSchema>;
type WorkflowStep = Schema.Schema.Type<typeof WorkflowStepSchema>;

const GITHUB_EXPRESSION = "$";
const PROVENANCE_ACTION =
  "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020";
const REQUIRED_BUILD_SOURCE = [
  "pnpm test:scripts",
  "pnpm --filter @nakafa/cli typecheck",
  "pnpm --filter @nakafa/cli test:coverage",
  "pnpm --filter @nakafa/cli build",
  "pnpm exec esbuild scripts/github/provenance/main.ts",
  "createRequire(import.meta.url)",
  "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
  "cli-release",
  "provenance.mjs",
] as const;
const REQUIRED_PUBLISH_SOURCE = [
  "actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c",
  PROVENANCE_ACTION,
  "EXPECTED_SHA256",
  "EXPECTED_SIZE",
  "EXPECTED_VERIFIER_SHA256",
  "EXPECTED_VERIFIER_SIZE",
  "NPM_CLI",
  "npm@12.0.2",
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
const FORBIDDEN_PRIVILEGED_CODE = /\bpnpm\b|\bnode\b|packages\/|scripts\//u;

export class CliWorkflowPolicyError extends Schema.TaggedError<CliWorkflowPolicyError>()(
  "CliWorkflowPolicyError",
  { problems: Schema.NonEmptyArray(Schema.String) }
) {}

/** Removes blank and disabled lines from one decoded shell program. */
function executableSource(run: string | undefined) {
  return (run ?? "")
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith("#");
    })
    .join("\n");
}

/** Converts one decoded workflow step into bounded executable source. */
function stepSource(step: WorkflowStep) {
  return [
    executableSource(step.run),
    step.uses,
    ...Object.entries(step.env ?? {}).flat(),
    ...Object.entries(step.with ?? {}).flat(),
  ]
    .filter((value) => value !== undefined)
    .join("\n");
}

/** Converts one decoded job into bounded step source. */
function jobSource(job: WorkflowJob) {
  return job.steps.map(stepSource).join("\n");
}

/** Decodes the exact workflow structure without trusting comments. */
function decodeWorkflow(source: string) {
  const document = parseDocument(source);
  if (document.errors.length > 0) {
    return Option.none();
  }
  return Schema.decodeUnknownOption(CliWorkflowSchema)(document.toJS());
}

/** Adds every required fragment missing from one bounded job. */
function requireSource(
  problems: string[],
  owner: "build" | "publish",
  source: string,
  fragments: readonly string[]
): void {
  for (const fragment of fragments) {
    if (!source.includes(fragment)) {
      problems.push(
        `CLI ${owner} job is missing required contract: ${fragment}`
      );
    }
  }
}

/** Counts exact occurrences of one executable fragment. */
function occurrenceCount(source: string, fragment: string) {
  return source.split(fragment).length - 1;
}

/** Returns every violation of the isolated npm trusted-publishing contract. */
export function validateCliWorkflow(source: string): string[] {
  const problems: string[] = [];
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

  const decoded = decodeWorkflow(source);
  if (Option.isNone(decoded)) {
    problems.push("CLI workflow must contain a valid jobs mapping.");
    return problems;
  }

  const { jobs, permissions } = decoded.value;
  if (Object.keys(permissions).length > 0) {
    problems.push("CLI workflow root permissions must remain empty.");
  }
  const { build, publish } = jobs;
  if (!(build && publish)) {
    problems.push("CLI workflow requires separate build and publish jobs.");
    return problems;
  }

  if (
    build.if !==
    "github.ref == 'refs/heads/main' && github.repository == 'nakafaai/nakafa.com'"
  ) {
    problems.push("CLI build must target protected Nakafa main.");
  }
  const expectedOutputs = {
    archive: `${GITHUB_EXPRESSION}{{ steps.archive.outputs.archive }}`,
    sha256: `${GITHUB_EXPRESSION}{{ steps.archive.outputs.sha256 }}`,
    size: `${GITHUB_EXPRESSION}{{ steps.archive.outputs.size }}`,
    verifier_sha256: `${GITHUB_EXPRESSION}{{ steps.archive.outputs.verifier_sha256 }}`,
    verifier_size: `${GITHUB_EXPRESSION}{{ steps.archive.outputs.verifier_size }}`,
  };
  for (const [name, value] of Object.entries(expectedOutputs)) {
    if (build.outputs?.[name] !== value) {
      problems.push(`CLI build must export exact output: ${name}`);
    }
  }

  const buildSource = jobSource(build);
  const publishSource = jobSource(publish);
  requireSource(problems, "build", buildSource, REQUIRED_BUILD_SOURCE);
  requireSource(problems, "publish", publishSource, REQUIRED_PUBLISH_SOURCE);

  if (publish.permissions?.["id-token"] !== "write") {
    problems.push("Only the publish job must receive npm OIDC identity.");
  }
  if (publish.environment !== "npm-production") {
    problems.push(
      "CLI publication must use the protected npm-production environment."
    );
  }
  for (const [name, job] of Object.entries(jobs)) {
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

  const setup = publish.steps.find(({ uses }) => uses === PROVENANCE_ACTION);
  if (setup?.with?.["node-version"] !== "24.19.0") {
    problems.push("CLI provenance must use the repository Node runtime.");
  }
  if (setup?.with?.["package-manager-cache"] !== false) {
    problems.push("CLI publication must disable package-manager caching.");
  }

  const publishCommands = publish.steps
    .flatMap(({ run }) => (run === undefined ? [] : [run]))
    .map(executableSource)
    .join("\n");
  if (occurrenceCount(publishCommands, 'node "$VERIFIER"') !== 1) {
    problems.push("CLI publication must execute one transported verifier.");
  }
  if (
    FORBIDDEN_PRIVILEGED_CODE.test(
      publishCommands.replace('node "$VERIFIER"', "")
    )
  ) {
    problems.push("CLI publication must not execute other repository code.");
  }
  if (publish.steps.some(({ uses }) => uses?.startsWith("actions/checkout@"))) {
    problems.push("CLI publication must not checkout repository code.");
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
