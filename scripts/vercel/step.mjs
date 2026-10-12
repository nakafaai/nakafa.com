// The Ignored Build Step of every Vercel project, started as
// `node step.mjs <project>`. It prints the reason and sets the exit code that
// Vercel reads: 0 skips the build, 1 builds. It runs whenever it is started, so
// the only way to skip a build is a decision that `ignore.mjs` made, and every
// failure builds. It uses Node.js built-ins only, as `ignore.mjs` does.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runIgnoreStep } from "./ignore.mjs";

/**
 * The host of a real run: the git repository that contains the current
 * directory.
 * @returns {import("./ignore.mjs").Host}
 */
function makeNodeHost() {
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  return {
    git: (args) =>
      execFileSync("git", ["-C", root, ...args], {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        stdio: ["ignore", "pipe", "ignore"],
      }),
    list: (dir) => readdirSync(join(root, dir)),
    read: (file) =>
      existsSync(join(root, file))
        ? readFileSync(join(root, file), "utf8")
        : undefined,
  };
}

let decision;
try {
  decision = runIgnoreStep({
    argv: process.argv,
    env: process.env,
    host: makeNodeHost(),
  });
} catch (error) {
  decision = {
    build: true,
    reason: `The decision failed (${String(error)}), so it builds.`,
  };
}
process.stdout.write(`${decision.reason}\n`);
process.exitCode = decision.build ? 1 : 0;
