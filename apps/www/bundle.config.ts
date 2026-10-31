import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Array as Arr, Record as Rec } from "effect";
import type { Plugin, Rollup } from "vite";
import { SHELL_PATH } from "#www/src/lib/routing/shell";
import { prepareShell } from "#www/src/lib/static/scripts";

/*
 * What the browser's bundle holds, and which files a school host starts from its
 * first bytes. A slow phone pays for each request as much as for each byte, so
 * this is where a page's first load is shaped.
 */

/** The font files that the font-src policy must load from this origin, never inline. */
const FONT_FILE_PATTERN = /\.woff2?$/u;

/** The browser build's assets: a font file stays a file, and others keep the inline limit. */
export const browserAssets = {
  assetsInlineLimit: (filePath: string) =>
    FONT_FILE_PATTERN.test(filePath) ? false : undefined,
};

/** The school layout's code, which every school page reads. */
const SCHOOL_LAYOUT = /\/routes\/school\/\$slug\/route\.tsx\?tsr-split/u;

/** The shell of a member's school, which a browser with a session reads too. */
const SCHOOL_MEMBER = /\/components\/tenant\/member\.tsx$/u;

/** The chunks, the given ones first, that the given ones reach through static imports. */
function withImports(
  chunks: readonly Rollup.OutputChunk[],
  reached: readonly Rollup.OutputChunk[]
): readonly Rollup.OutputChunk[] {
  const names = Arr.map(reached, (chunk) => chunk.fileName);
  const imports = Arr.flatMap(reached, (chunk) => chunk.imports);
  const next = Arr.filter(
    chunks,
    (chunk) =>
      Arr.contains(imports, chunk.fileName) &&
      !Arr.contains(names, chunk.fileName)
  );
  return next.length === 0
    ? reached
    : withImports(chunks, Arr.appendAll(reached, next));
}

/** The addresses of the scripts that a module's code needs before it can run. */
function scriptsOf(chunks: readonly Rollup.OutputChunk[], module: RegExp) {
  const own = Arr.filter(chunks, (chunk) =>
    Arr.some(chunk.moduleIds, (id) => module.test(id))
  );
  return Arr.map(withImports(chunks, own), (chunk) => `/${chunk.fileName}`);
}

/**
 * Hands the browser shell the scripts of a school. The client build knows them, and the shell is
 * written last, so this reads the chunks once and prepares the shell after every environment.
 */
export function prepareBrowserShell(): Plugin {
  let school: readonly string[] = [];
  let member: readonly string[] = [];
  return {
    apply: "build",
    applyToEnvironment: (environment) => environment.name === "client",
    buildApp: {
      order: "post",
      handler: (builder) => {
        const file = join(
          builder.environments.client.config.build.outDir,
          SHELL_PATH,
          "index.html"
        );
        if (existsSync(file)) {
          writeFileSync(
            file,
            prepareShell(readFileSync(file, "utf8"), { member, school })
          );
        }
        return Promise.resolve();
      },
    },
    enforce: "post",
    generateBundle(_, bundle) {
      const chunks = Arr.filter(
        Rec.values(bundle),
        (entry): entry is Rollup.OutputChunk => entry.type === "chunk"
      );
      school = scriptsOf(chunks, SCHOOL_LAYOUT);
      member = Arr.difference(scriptsOf(chunks, SCHOOL_MEMBER), school);
    },
    name: "www:prepare-browser-shell",
  };
}
