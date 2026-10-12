// The machine behind the Ignored Build Step: the git repository that contains a
// directory. It uses Node.js built-ins only, as `ignore.mjs` does, because the
// step may run before any dependency is installed.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The host of a real run: the git repository that contains `cwd`. It throws
 * when `cwd` is in no repository.
 * @param {string} cwd
 * @returns {import("./ignore.mjs").Host}
 */
export function makeNodeHost(cwd) {
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd,
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
