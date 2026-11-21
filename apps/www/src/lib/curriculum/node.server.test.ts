// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { GitCommitShaSchema } from "@nakafa/aksara-contracts/ids";
import { Array as Arr, Effect } from "effect";
import { readCurriculumPage } from "@/lib/curriculum/node.server";
import { previewProjection } from "@/test/manifest";
import {
  testProgramClass,
  testProgramContexts,
  testProgramGroups,
  testProgramRoot,
  testProgramSubject,
  testPublishedProgram,
} from "@/test/published/program";

const program = vi.hoisted(() => ({ catalog: vi.fn(), route: vi.fn() }));
const seo = vi.hoisted(() => ({ resolve: vi.fn() }));
const canonical = vi.hoisted(() => ({ broken: false }));
const revision = GitCommitShaSchema.make("a".repeat(40));

vi.mock("@/lib/content/program/catalog", () => ({
  readPublishedProgramCatalog: program.catalog,
}));
vi.mock("@/lib/content/program/route", () => ({
  readPublishedProgramRoute: program.route,
}));
vi.mock("@/lib/seo/generator", () => ({
  /** Records the SEO context of the node, and answers with fixed copy. */
  resolveSEOMetadata: seo.resolve,
}));
vi.mock("@repo/internationalization/src/rewrite", async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import("@repo/internationalization/src/rewrite")
    >();
  return {
    ...original,
    /** Spells a path as its canonical address, or as no address at all when a test breaks it. */
    toCanonicalPath: (pathname: string) =>
      canonical.broken ? "not-an-address" : original.toCanonicalPath(pathname),
  };
});

/** One signed curriculum route as the release publishes it, with or without its source revision. */
function publishedRoute(sourceRevision: typeof revision | null) {
  return {
    activeReleaseId: "program-release",
    alternates: [testProgramSubject],
    ancestors: [testProgramRoot, testProgramClass],
    children: [testProgramClass],
    contexts: testProgramContexts,
    groups: testProgramGroups,
    materials: [previewProjection],
    program: testPublishedProgram,
    route: testProgramSubject,
    sourceRevision,
  };
}

const INPUT = {
  curriculum: "merdeka",
  locale: "en",
  path: ["class-11", "mathematics"],
};

beforeEach(() => {
  canonical.broken = false;
  seo.resolve.mockReset().mockReturnValue(
    Effect.succeed({
      description: "Test node description",
      title: "Test node",
    })
  );
  program.catalog.mockReset().mockReturnValue(
    Effect.succeed({
      entries: [
        {
          program: testPublishedProgram,
          route: testProgramRoot,
          translation: testPublishedProgram.translations[0],
        },
      ],
      sourceRevision: revision,
    })
  );
  program.route.mockReset();
});

describe("readCurriculumPage", () => {
  it.effect(
    "reads a node's crumbs, cards, outline and copy from the release's curriculum",
    () =>
      Effect.gen(function* () {
        program.route.mockReturnValue(Effect.succeed(publishedRoute(revision)));

        const page = yield* readCurriculumPage(INPUT);

        expect(page).toMatchObject({
          canonicalPath: "/en/curricula/merdeka/class-11/mathematics",
          description: "Test node description",
          kind: "found",
          labels: { home: "Home" },
          locale: "en",
          materialCards: [{ items: [{ title: "Function Concept" }] }],
          route: { publicPath: testProgramSubject.publicPath },
          title: "Test node",
        });
        expect(page.kind === "found" && page.sourceUrl).toContain(revision);
        expect(page.kind === "found" && page.childCards).toHaveLength(1);
        expect(seo.resolve).toHaveBeenCalledWith(
          expect.objectContaining({
            topics: Arr.map(
              page.kind === "found" ? page.materialCards : [],
              (card) => card.title
            ),
          }),
          "en"
        );
      })
  );

  it.effect(
    "names a node's child routes as its topics when it lists no materials",
    () =>
      Effect.gen(function* () {
        program.route.mockReturnValue(
          Effect.succeed({
            ...publishedRoute(revision),
            contexts: [],
            groups: [],
          })
        );

        const page = yield* readCurriculumPage(INPUT);

        expect(page).toMatchObject({ kind: "found", materialCards: [] });
        expect(seo.resolve).toHaveBeenCalledWith(
          expect.objectContaining({ topics: [testProgramClass.title] }),
          "en"
        );
      })
  );

  it.effect("names no source for a node whose release names no revision", () =>
    Effect.gen(function* () {
      program.route.mockReturnValue(Effect.succeed(publishedRoute(null)));

      const page = yield* readCurriculumPage(INPUT);

      expect(page).toMatchObject({ kind: "found", sourceUrl: null });
    })
  );

  it.effect("answers not found for a node with no canonical address", () =>
    Effect.gen(function* () {
      program.route.mockReturnValue(Effect.succeed(publishedRoute(revision)));
      canonical.broken = true;

      expect(yield* readCurriculumPage(INPUT)).toEqual({ kind: "notFound" });
    })
  );
});
