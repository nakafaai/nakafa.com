import { describe, expect, it } from "@effect/vitest";
import { LearningProgramKeySchema } from "@nakafa/aksara-contracts/program/spec";
import { countTextTokens } from "@repo/backend/confect/nina/budget";
import type { NinaContextPack } from "@repo/backend/confect/nina/contract/pack";
import type { NinaPage } from "@repo/backend/confect/nina/contract/turn";
import { formatTurnContext } from "@repo/backend/confect/nina/prompt/runtime";
import { Array as Arr } from "effect";

const url = "https://nakafa.com/id/materi/matematika/integral/jumlahan-riemann";
const learning = {
  assetId: "asset:id:material:mathematics:integral:riemann-sum",
  contentId: "asset:id:material:mathematics:integral:riemann-sum",
  locale: "id",
  materialKey: "mathematics",
  section: "subject-lesson",
  slug: "materi/matematika/integral/jumlahan-riemann",
  sourcePath: "material/lesson/mathematics/integral/riemann-sum",
  title: "Jumlahan Riemann",
  url,
  verified: true,
} as const;
const tools = {
  allowDeepResearch: true,
  allowMath: true,
  allowNakafa: true,
  allowPageFetch: true,
  evidenceScope: "verified-page",
} as const;
const nina = {
  learning,
  snapshot: {
    capturedAt: "2026-05-09T00:00:00.000Z",
    learning,
    source: "current-page",
    tools,
  },
  tools,
  transition: {
    reason: "page-context",
    toContextKey: "canonical:materi/matematika/integral/jumlahan-riemann",
  },
} satisfies NinaContextPack;
const page = {
  locale: "id",
  needsFetch: true,
  nina,
  slug: learning.slug,
  url,
  verified: true,
} satisfies NinaPage;
const runtime = { currentDate: "2026-05-09T00:00:00.000Z" };

describe("formatTurnContext", () => {
  it("says Nakafa wrote it, then names the page, the date and the tool policy", () => {
    const context = formatTurnContext({ page, runtime, user: {} });

    expect(context.startsWith("# Runtime Context")).toBe(true);
    expect(context).toContain("Nakafa wrote this for the learner's message");
    expect(context).toContain(`- url: ${url}`);
    expect(context).toContain("- locale: id");
    expect(context).toContain(`- slug: ${learning.slug}`);
    expect(context).toContain("- verified: yes");
    expect(context).toContain("- date: 2026-05-09T00:00:00.000Z");
    expect(context).toContain("- title: Jumlahan Riemann");
    expect(context).toContain("- current page content provided: yes");
    expect(context).toContain("- curriculum preference: not selected");
    expect(
      Arr.every(context.split("\n"), (line) => !line.startsWith("      "))
    ).toBe(true);
  });

  it("names the page once, in the context pack, and not again as the current page", () => {
    const lines = formatTurnContext({ page, runtime, user: {} }).split("\n");

    expect(Arr.filter(lines, (line) => line === `- url: ${url}`)).toHaveLength(
      1
    );
    expect(
      Arr.filter(lines, (line) => line === `- slug: ${learning.slug}`)
    ).toHaveLength(1);
    expect(lines).not.toContain("Current page:");
    expect(lines).toContain("Learning asset:");
  });

  it("names the selected curriculum preference", () => {
    const context = formatTurnContext({
      page,
      runtime,
      user: {
        curriculumPreference: {
          program: {
            key: LearningProgramKeySchema.make("cambridge-international"),
            title: "Cambridge International",
          },
        },
      },
    });

    expect(context).toContain("- curriculum preference: selected");
    expect(context).toContain("- curriculum: Cambridge International");
    expect(context).toContain("- curriculum key: cambridge-international");
  });

  it("stays short, even with a placement and a chosen curriculum", () => {
    const programKey = LearningProgramKeySchema.make(
      "cambridge-lower-secondary"
    );
    const context = formatTurnContext({
      page: {
        ...page,
        nina: {
          ...nina,
          placement: {
            mode: "placement",
            nodeKey: "curriculum:vector:addition",
            parentHref: "/id/kurikulum/matematika/vektor#vektor",
            parentTitle: "Vektor",
            programKey,
          },
        },
      },
      runtime,
      user: {
        curriculumPreference: {
          program: { key: programKey, title: "Cambridge Lower Secondary" },
        },
      },
    });

    // This block weighs 287 tokens by the shared tokenizer, and it travels with every learner message.
    expect(countTextTokens(context)).toBeLessThan(300);
  });

  it("follows the runtime facts with the memories the turn recalls, and adds nothing without them", () => {
    const memories =
      "# Memories\n<memories>\n- Kelas 12 IPA (2026-10-11)\n</memories>";
    const bare = formatTurnContext({ page, runtime, user: {} });
    const recalled = formatTurnContext({ memories, page, runtime, user: {} });
    expect(recalled).toBe(`${bare}\n\n${memories}`);
    expect(
      formatTurnContext({ memories: undefined, page, runtime, user: {} })
    ).toBe(bare);
  });

  it("says so when the page has no signed content", () => {
    const bare = { ...learning, verified: false };
    const context = formatTurnContext({
      page: {
        ...page,
        nina: { ...nina, learning: bare },
        verified: false,
      },
      runtime,
      user: {},
    });

    expect(context).toContain("- verified: no");
  });
});
