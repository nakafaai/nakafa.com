// Decides whether one Vercel project needs a new build.
//
// `step.mjs` runs this decision as the Ignored Build Step of each project.
// Vercel runs that step when the deployment enters the building state, and the
// build step that follows begins by installing the dependencies. Its own
// examples for the step run `npx turbo-ignore` and a global `turbo`. So nothing
// can be assumed to be installed, and these modules are plain JavaScript with
// no import but Node.js built-ins: the Effect modules that the rest of the
// repository is written with may not exist yet. This module imports nothing at
// all and reads the machine only through the `Host` that its caller hands it.

/**
 * One workspace of the monorepo.
 * @typedef {object} Workspace
 * @property {string} name The package name.
 * @property {string} dir The directory, relative to the repository root.
 * @property {readonly string[]} dependencies The names of the packages it lists
 * as dependencies of any kind.
 */

/**
 * Whether a project needs a build, and the sentence that says why.
 * @typedef {object} Decision
 * @property {boolean} build
 * @property {string} reason What Vercel prints in the build log.
 */

/**
 * What the step reads from the machine, so that a test can stand in for it.
 * @typedef {object} Host
 * @property {(args: readonly string[]) => string} git Runs git in the
 * repository and returns its output, or throws.
 * @property {(dir: string) => string[]} list Lists a directory of the
 * repository by entry name.
 * @property {(file: string) => string | undefined} read Reads a text file of
 * the repository, or answers nothing when it is absent.
 */

/** The root files that every project is installed or built from. */
const ROOT_INPUTS = new Set([
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "turbo.json",
]);

/** Documentation and tests: files that no build reads. */
const NOT_BUILT_PATTERN = /(?:\.md|\.test\.[cm]?[jt]sx?)$/u;

/** Next.js serves every file under a `public` folder, whatever its name. */
const PUBLIC_PATTERN = /(?:^|\/)public\//u;

/** One list item of `pnpm-workspace.yaml`. */
const LIST_ITEM_PATTERN = /^\s+-\s+(\S+)\s*$/u;

/** A workspace pattern of the one form that is understood: `dir/*`. */
const WORKSPACE_ROOT_PATTERN = /^([\w.-]+)\/\*$/u;

/** The package fields that list a dependency. */
const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];

/**
 * Reads the workspace directories from the text of `pnpm-workspace.yaml`. Only
 * the `dir/*` form is understood. Any other pattern throws, so the step builds
 * instead of guessing which directories hold workspaces.
 * @param {string} text
 * @returns {string[]}
 */
export function readWorkspaceRoots(text) {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line.trim() === "packages:");
  if (start === -1) {
    throw new Error("pnpm-workspace.yaml lists no packages.");
  }
  const roots = [];
  for (const line of lines.slice(start + 1)) {
    const item = LIST_ITEM_PATTERN.exec(line);
    if (item === null) {
      break;
    }
    const root = WORKSPACE_ROOT_PATTERN.exec(item[1]);
    if (root === null) {
      throw new Error(`The workspace pattern ${item[1]} is not dir/*.`);
    }
    roots.push(root[1]);
  }
  return roots;
}

/**
 * Describes one workspace from its package manifest.
 * @param {string} dir
 * @param {Record<string, unknown>} manifest
 * @returns {Workspace}
 */
export function describeWorkspace(dir, manifest) {
  const dependencies = DEPENDENCY_FIELDS.flatMap((field) => {
    const listed = manifest[field];
    return typeof listed === "object" && listed !== null
      ? Object.keys(listed)
      : [];
  });
  return {
    dependencies,
    dir,
    name: typeof manifest.name === "string" ? manifest.name : dir,
  };
}

/**
 * The workspaces that `project` is built from: itself and every workspace it
 * depends on, directly or through another.
 * @param {string} project
 * @param {readonly Workspace[]} workspaces
 * @returns {Workspace[]}
 */
function readClosure(project, workspaces) {
  const byName = new Map(
    workspaces.map((workspace) => [workspace.name, workspace])
  );
  const inputs = [];
  const seen = new Set();
  const pending = [project];
  for (let name = pending.pop(); name !== undefined; name = pending.pop()) {
    const workspace = byName.get(name);
    if (workspace !== undefined && !seen.has(name)) {
      seen.add(name);
      inputs.push(workspace);
      pending.push(...workspace.dependencies);
    }
  }
  return inputs;
}

/**
 * Decides whether `project` needs a build after the files in `changedFiles`
 * changed. A project is built from its own workspace, every workspace that it
 * depends on, the lockfile and the root configuration. `www` depends on
 * `@repo/backend`, whose Convex functions its build deploys, so a change to the
 * backend builds it. A change to documentation or to a test builds nothing,
 * unless the file is served from a `public` folder. Nothing proves a skip when
 * no file is listed, so that case builds.
 * @param {object} input
 * @param {string} input.project The workspace name of the project.
 * @param {readonly Workspace[]} input.workspaces
 * @param {readonly string[]} input.changedFiles Paths relative to the root.
 * @returns {Decision}
 */
export function decideBuild({ changedFiles, project, workspaces }) {
  if (changedFiles.length === 0) {
    return { build: true, reason: "No changed file is listed, so it builds." };
  }
  const inputs = readClosure(project, workspaces);
  if (inputs.length === 0) {
    return {
      build: true,
      reason: `${project} is not a workspace, so it builds.`,
    };
  }
  for (const file of changedFiles) {
    if (ROOT_INPUTS.has(file)) {
      return { build: true, reason: `${file} is an input of every project.` };
    }
    const owner = inputs.find(({ dir }) => file.startsWith(`${dir}/`));
    const isBuilt = PUBLIC_PATTERN.test(file) || !NOT_BUILT_PATTERN.test(file);
    if (owner !== undefined && isBuilt) {
      const through = owner.name === project ? "" : ` through ${owner.name}`;
      return {
        build: true,
        reason: `${file} is an input of ${project}${through}.`,
      };
    }
  }
  return {
    build: false,
    reason: `Nothing that ${project} is built from changed, so it is skipped.`,
  };
}

/**
 * Reads every workspace of the repository.
 * @param {Host} host
 * @returns {Workspace[]}
 */
function readWorkspaces(host) {
  const roots = readWorkspaceRoots(host.read("pnpm-workspace.yaml") ?? "");
  return roots.flatMap((root) =>
    host.list(root).flatMap((entry) => {
      const manifest = host.read(`${root}/${entry}/package.json`);
      return manifest === undefined
        ? []
        : [describeWorkspace(`${root}/${entry}`, JSON.parse(manifest))];
    })
  );
}

/**
 * Makes the decision for the project named on the command line. Vercel sets
 * `VERCEL_GIT_PREVIOUS_SHA` to the commit of the last successful deployment of
 * the project and branch, so a deployment that failed, or that this step
 * skipped, is never the baseline: the files that changed since the last good
 * deployment are what a skipped build would have left out. Vercel clones only
 * ten commits, so a baseline that is further back is missing from the clone and
 * the project builds, which sets a new baseline once it succeeds. The reason
 * names the baseline, so the build log shows what the decision compared.
 * https://vercel.com/docs/environment-variables/system-environment-variables
 * https://vercel.com/docs/builds/configure-a-build
 * @param {object} input
 * @param {readonly string[]} input.argv The command line, as `process.argv`.
 * @param {Record<string, string | undefined>} input.env
 * @param {Host} input.host
 * @returns {Decision}
 */
export function runIgnoreStep({ argv, env, host }) {
  const project = argv[2];
  const previous = env.VERCEL_GIT_PREVIOUS_SHA;
  if (project === undefined) {
    return { build: true, reason: "No project is named, so it builds." };
  }
  if (previous === undefined || previous === "") {
    return {
      build: true,
      reason: "There is no earlier deployment, so it builds.",
    };
  }
  try {
    host.git(["cat-file", "-e", `${previous}^{commit}`]);
  } catch {
    return {
      build: true,
      reason: `${previous} is not in this shallow clone, so it builds.`,
    };
  }
  const changedFiles = host
    .git([
      "diff",
      "--name-only",
      "--no-renames",
      "-z",
      previous,
      env.VERCEL_GIT_COMMIT_SHA || "HEAD",
    ])
    .split("\0")
    .filter(Boolean);
  const decision = decideBuild({
    changedFiles,
    project,
    workspaces: readWorkspaces(host),
  });
  return {
    ...decision,
    reason: `${decision.reason} Compared with ${previous}.`,
  };
}

/**
 * What the step reports to Vercel.
 * @typedef {object} Outcome
 * @property {number} exitCode 1 builds and 0 skips, the two codes Vercel reads.
 * @property {string} output The line for the build log.
 */

/**
 * Turns the decision into the outcome that Vercel reads. Only a decision that
 * says to skip gives 0. A host that cannot be made and a decision that throws
 * are failures, and every failure builds.
 * @param {object} input
 * @param {readonly string[]} input.argv The command line, as `process.argv`.
 * @param {Record<string, string | undefined>} input.env
 * @param {() => Host} input.makeHost Makes the host, which may throw.
 * @returns {Outcome}
 */
export function settleIgnoreStep({ argv, env, makeHost }) {
  let decision;
  try {
    decision = runIgnoreStep({ argv, env, host: makeHost() });
  } catch (error) {
    decision = {
      build: true,
      reason: `The decision failed (${String(error)}), so it builds.`,
    };
  }
  return { exitCode: decision.build ? 1 : 0, output: decision.reason };
}
