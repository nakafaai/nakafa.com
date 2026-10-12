// The Ignored Build Step of every Vercel project, started as
// `node step.mjs <project>`. It prints the reason and sets the exit code that
// Vercel reads: 0 skips the build, 1 builds. It runs whenever it is started, so
// the only way to skip a build is a decision that `ignore.mjs` made, and every
// failure builds. It uses Node.js built-ins only, as `ignore.mjs` does.
import { makeNodeHost } from "./host.mjs";
import { settleIgnoreStep } from "./ignore.mjs";

const { exitCode, output } = settleIgnoreStep({
  argv: process.argv,
  env: process.env,
  makeHost: () => makeNodeHost(process.cwd()),
});
process.stdout.write(`${output}\n`);
process.exitCode = exitCode;
