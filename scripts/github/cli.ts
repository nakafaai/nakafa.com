import { createHash } from "node:crypto";
import { Effect, Option, Schema } from "effect";
import { parseDocument } from "yaml";

const WorkflowStepSchema = Schema.Struct({
  env: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
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
  defaults: Schema.optional(Schema.Unknown),
  env: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  jobs: Schema.Record(Schema.String, WorkflowJobSchema),
  permissions: Schema.Record(Schema.String, Schema.String),
});

type WorkflowJob = Schema.Schema.Type<typeof WorkflowJobSchema>;

const SETUP_NODE_ACTION =
  "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020";
const UPLOAD_ACTION =
  "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a";
/** Digest of the decoded publish job after a complete OIDC boundary review. */
const TRUSTED_PUBLISH_SHA256 =
  "f6498b7967e2631f6a5c413e301c32308f496505e451b95504fb486f0558554d";
/** Digest of the decoded verification job after a complete execution review. */
const TRUSTED_VERIFY_SHA256 =
  "afbae931e9df2cded2af3a67e81f81e1b7a81c1b21eff86ea18480a7d0008509";
const REQUIRED_BUILD_SOURCE = [
  "pnpm test:scripts",
  "pnpm --filter @nakafa/cli typecheck",
  "pnpm --filter @nakafa/cli test:coverage",
  "pnpm --filter @nakafa/cli build",
  "npm pack ./packages/cli",
  "pnpm exec esbuild scripts/github/provenance/main.ts",
  "createRequire(import.meta.url)",
  "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
  "cli-package",
  "cli-verifier",
  "provenance.mjs",
] as const;
const REQUIRED_PUBLISH_SOURCE = [
  "actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c",
  SETUP_NODE_ACTION,
  "cli-package",
  "EXPECTED_SHA256",
  "EXPECTED_SIZE",
  "NPM_CLI",
  "npm@12.0.2",
  "NPM_CONFIG_REGISTRY",
  "ACTIONS_ID_TOKEN_REQUEST_URL",
  "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
  "expected_shasum",
  "expected_integrity",
  "npm error code E404",
  "for attempt in {1..5}",
  'npx --yes "$NPM_CLI" publish "$TARBALL"',
  "--ignore-scripts",
  "--provenance",
] as const;
const REQUIRED_VERIFY_SOURCE = [
  "actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c",
  SETUP_NODE_ACTION,
  "cli-package",
  "cli-verifier",
  "EXPECTED_VERIFIER_SHA256",
  "EXPECTED_VERIFIER_SIZE",
  "NPM_CONFIG_REGISTRY",
  "ACTIONS_ID_TOKEN_REQUEST_URL",
  "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
  "npm/v1/attestations/",
  "audit signatures --json",
  "--include-attestations",
  'node "$VERIFIER"',
  '".github/workflows/cli-publish.yml"',
  '"refs/heads/main"',
  '"npm-production"',
  "for attempt in {1..10}",
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
const SHELL_COMMENT = /(^|[ \t])#.*$/u;

export class CliWorkflowPolicyError extends Schema.TaggedError<CliWorkflowPolicyError>()(
  "CliWorkflowPolicyError",
  { problems: Schema.NonEmptyArray(Schema.String) }
) {}

function executableSource(run: string | undefined) {
  return (run ?? "")
    .split("\n")
    .map((line) => line.replace(SHELL_COMMENT, "$1").trimEnd())
    .filter((line) => line.trim().length > 0)
    .join("\n");
}

function stepSource(step: WorkflowJob["steps"][number]) {
  return [
    executableSource(step.run),
    step.uses,
    ...Object.entries(step.env ?? {}).flat(),
    ...Object.entries(step.with ?? {}).flat(),
  ]
    .filter((value) => value !== undefined)
    .join("\n");
}

function jobSource(job: WorkflowJob) {
  return job.steps.map(stepSource).join("\n");
}

function hasRerunnableArtifacts(build: WorkflowJob) {
  const uploads = build.steps.filter(({ uses }) => uses === UPLOAD_ACTION);
  return (
    uploads.length === 2 &&
    uploads.every(({ with: inputs }) => inputs?.overwrite === true) &&
    ["cli-package", "cli-verifier"].every((name) =>
      uploads.some(({ with: inputs }) => inputs?.name === name)
    )
  );
}

function decodeWorkflow(source: string) {
  const document = parseDocument(source);
  if (document.errors.length > 0) {
    return Option.none();
  }
  return Schema.decodeUnknownOption(CliWorkflowSchema, {
    onExcessProperty: "preserve",
  })(document.toJS());
}

function requireSource(
  problems: string[],
  owner: "build" | "publish" | "verify",
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

function trustedPublishProblems(publish: WorkflowJob, source: string) {
  const problems: string[] = [];
  const commands = publish.steps
    .flatMap(({ run }) => (run === undefined ? [] : [run]))
    .map(executableSource)
    .join("\n");
  if (commands.split('npx --yes "$NPM_CLI" publish "$TARBALL"').length !== 2) {
    problems.push("CLI publication may execute only one npm publish command.");
  }
  const sha256 = createHash("sha256")
    .update(JSON.stringify(publish))
    .digest("hex");
  if (sha256 !== TRUSTED_PUBLISH_SHA256) {
    problems.push("CLI publication must match the exact trusted job.");
  }
  if (
    source.includes("cli-verifier") ||
    source.includes("provenance.mjs") ||
    source.includes("VERIFIER")
  ) {
    problems.push("CLI publication must not receive the verifier artifact.");
  }
  if (publish.steps.some(({ uses }) => uses?.startsWith("actions/checkout@"))) {
    problems.push("CLI publication must not checkout repository code.");
  }
  return problems;
}

function trustedVerifyProblems(verify: WorkflowJob) {
  const sha256 = createHash("sha256")
    .update(JSON.stringify(verify))
    .digest("hex");
  return sha256 === TRUSTED_VERIFY_SHA256
    ? []
    : ["CLI verification must match the exact trusted job."];
}

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

  const { defaults, env, jobs, permissions } = decoded.value;
  if (Object.keys(permissions).length > 0) {
    problems.push("CLI workflow root permissions must remain empty.");
  }
  if (defaults !== undefined) {
    problems.push("CLI workflow must not inherit root run defaults.");
  }
  if (env !== undefined) {
    problems.push("CLI workflow must not inherit root environment values.");
  }
  const { build, publish, verify } = jobs;
  if (!(build && publish && verify)) {
    problems.push(
      "CLI workflow requires separate build, publish, and verify jobs."
    );
    return problems;
  }

  if (
    build.if !==
    "github.ref == 'refs/heads/main' && github.repository == 'nakafaai/nakafa.com'"
  ) {
    problems.push("CLI build must target protected Nakafa main.");
  }
  for (const name of [
    "archive",
    "sha256",
    "size",
    "verifier_sha256",
    "verifier_size",
  ]) {
    const value = `\${{ steps.archive.outputs.${name} }}`;
    if (build.outputs?.[name] !== value) {
      problems.push(`CLI build must export exact output: ${name}`);
    }
  }

  const buildSource = jobSource(build);
  const publishSource = jobSource(publish);
  const verifySource = jobSource(verify);
  requireSource(problems, "build", buildSource, REQUIRED_BUILD_SOURCE);
  requireSource(problems, "publish", publishSource, REQUIRED_PUBLISH_SOURCE);
  requireSource(problems, "verify", verifySource, REQUIRED_VERIFY_SOURCE);

  if (!hasRerunnableArtifacts(build)) {
    problems.push("CLI build artifacts must be replaceable on rerun.");
  }

  if (publish.permissions?.["id-token"] !== "write") {
    problems.push("Only the publish job must receive npm OIDC identity.");
  }
  if (publish.environment !== "npm-production") {
    problems.push(
      "CLI publication must use the protected npm-production environment."
    );
  }
  if (verify.environment !== undefined) {
    problems.push("CLI verification must not use a protected environment.");
  }
  if (Object.keys(verify.permissions ?? {}).length > 0) {
    problems.push("CLI verification permissions must remain empty.");
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

  const verifyNeeds = Array.isArray(verify.needs)
    ? verify.needs
    : [verify.needs].filter((need) => need !== undefined);
  if (
    verifyNeeds.length !== 2 ||
    !verifyNeeds.includes("build") ||
    !verifyNeeds.includes("publish")
  ) {
    problems.push("CLI verification must consume build and publication.");
  }

  for (const [owner, job] of [
    ["publication", publish],
    ["verification", verify],
  ] as const) {
    const setup = job.steps.find(({ uses }) => uses === SETUP_NODE_ACTION);
    if (setup?.with?.["node-version"] !== "24.19.0") {
      problems.push(`CLI ${owner} must use the repository Node runtime.`);
    }
    if (setup?.with?.["package-manager-cache"] !== false) {
      problems.push(`CLI ${owner} must disable package-manager caching.`);
    }
  }

  problems.push(...trustedPublishProblems(publish, publishSource));

  const verifyCommands = verify.steps
    .flatMap(({ run }) => (run === undefined ? [] : [run]))
    .map(executableSource)
    .join("\n");
  if (verifyCommands.split('node "$VERIFIER"').length !== 2) {
    problems.push("CLI verification must execute one transported verifier.");
  }
  problems.push(...trustedVerifyProblems(verify));

  return problems;
}

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
