import { layer as NodeServices } from "@effect/platform-node/NodeServices";
import {
  Array as Arr,
  Clock,
  Effect,
  FileSystem,
  Option,
  Path,
  Schema,
} from "effect";
import { buildRootLlmsIndexText } from "@/lib/llms/index/public";
import { readOgCopy } from "@/lib/og/copy.server";
import { readRssText } from "@/lib/seo/feed";
import { readManifestText } from "@/lib/seo/manifest";
import { readSitemapFiles } from "@/lib/sitemap/files";
import {
  readSocialImageSources,
  type SocialImageSource,
} from "@/lib/static/social";
import { readRuntimeConfig } from "@/runtime";
import { renderSocialImage } from "@/scripts/static/social";

/**
 * Writes the static artifacts of the release into the client output: the sitemap
 * index and its pages, the RSS feed, llms.txt, the manifest and every social image.
 * Each file carries the bytes that the runtime answered for the same address, so
 * the Worker serves them without rendering anything. `run.mjs` calls it after the
 * client build.
 */

/** The logo that every social image shows, read from the same file the image route bundled. */
const LOGO_FILE = "public/logo.svg";

/** One text artifact of the release, at its path under the client output. */
const TextArtifact = Schema.Struct({
  path: Schema.String,
  text: Schema.String,
});
type TextArtifact = typeof TextArtifact.Type;

const writeArtifact = Effect.fn("www.static.write")(function* (
  outDir: string,
  file: string,
  body: string | Uint8Array
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = path.join(outDir, file);
  yield* fs.makeDirectory(path.dirname(target), { recursive: true });
  if (typeof body === "string") {
    yield* fs.writeFileString(target, body);
    return;
  }
  yield* fs.writeFile(target, body);
});

/** Renders the feeds and indexes of the release as text artifacts. */
const readTextArtifacts = Effect.fn("www.static.textArtifacts")(function* () {
  const sitemap = yield* readSitemapFiles();
  const rss = yield* readRssText();
  const manifest = yield* readManifestText();
  const rest: readonly TextArtifact[] = [
    { path: "rss.xml", text: rss },
    { path: "llms.txt", text: buildRootLlmsIndexText() },
    { path: "manifest.webmanifest", text: manifest },
  ];
  return [...sitemap, ...rest];
});

/** Renders one social image when its route names published content, and reports whether it did. */
const writeSocialImage = Effect.fn("www.static.socialImage")(function* (
  outDir: string,
  logoSvg: string,
  source: SocialImageSource
) {
  const segments = Arr.filter(source.slug.split("/"), (part) => part !== "");
  const copy = yield* readOgCopy(source.locale, segments);
  if (Option.isNone(copy)) {
    return false;
  }
  const png = yield* Effect.promise(() =>
    renderSocialImage({
      description: copy.value.description,
      logoSvg,
      title: copy.value.title,
    })
  );
  yield* writeArtifact(
    outDir,
    Arr.join([source.locale, "og", ...segments, "image.png"], "/"),
    png
  );
  return true;
});

const main = Effect.fn("www.static.build")(function* (outDir: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const textArtifacts = yield* readTextArtifacts();
  yield* Effect.forEach(
    textArtifacts,
    ({ path: file, text }) => writeArtifact(outDir, file, text),
    { concurrency: 8, discard: true }
  );

  const logoSvg = yield* fs.readFileString(path.resolve(LOGO_FILE));
  const sources = yield* readSocialImageSources();
  const started = yield* Clock.currentTimeMillis;
  const written = yield* Effect.forEach(
    sources,
    (source) => writeSocialImage(outDir, logoSvg, source),
    { concurrency: 8 }
  );
  const images = Arr.filter(written, Boolean).length;
  const elapsed = (yield* Clock.currentTimeMillis) - started;
  const perThousand = images === 0 ? 0 : (elapsed * 1000) / images;
  process.stdout.write(
    Arr.join(
      [
        `static text artifacts: ${textArtifacts.length}`,
        `social image sources: ${sources.length}`,
        `social images written: ${images}`,
        `social images skipped (no published copy): ${sources.length - images}`,
        `social image render time: ${elapsed} ms (${perThousand.toFixed(0)} ms per 1,000 images)`,
        "",
      ],
      "\n"
    )
  );
});

/** Writes every static artifact of the release into the client output directory. */
export async function buildStaticArtifacts(outDir: string) {
  readRuntimeConfig();
  await Effect.runPromise(main(outDir).pipe(Effect.provide(NodeServices)));
}
