import type { NinaContextPack } from "@repo/ai/nina/context";
import { formatNinaContextPackPrompt } from "@repo/ai/nina/prompt";
import { describe, expect, it } from "vitest";

const canonicalContext = {
  learning: {
    locale: "en",
    slug: "chat",
    url: "https://nakafa.com/en/chat",
    verified: false,
  },
  snapshot: {
    capturedAt: "2026-05-09T00:00:00.000Z",
    learning: {
      locale: "en",
      slug: "chat",
      url: "https://nakafa.com/en/chat",
      verified: false,
    },
    source: "current-page",
    tools: {
      allowDeepResearch: false,
      allowMath: false,
      allowNakafa: false,
      allowPageFetch: false,
      evidenceScope: "general-learning",
    },
  },
  tools: {
    allowDeepResearch: false,
    allowMath: false,
    allowNakafa: false,
    allowPageFetch: false,
    evidenceScope: "general-learning",
  },
  transition: {
    reason: "page-context",
    toContextKey: "canonical:chat",
  },
} satisfies NinaContextPack;

const placementContext = {
  learning: {
    assetId: "asset:id:material:mathematics:vector:addition",
    contentId: "asset:id:material:mathematics:vector:addition",
    locale: "en",
    materialKey: "mathematics",
    section: "subject-lesson",
    slug: "subjects/mathematics/vector/addition",
    sourcePath: "material/lesson/mathematics/vector/addition",
    title: "Vector Addition",
    url: "https://nakafa.com/en/subjects/mathematics/vector/addition",
    verified: true,
  },
  placement: {
    mode: "placement",
    nodeKey: "curriculum:vector:addition",
    parentHref: "/en/curriculum/mathematics/vector",
    parentTitle: "Vector",
    programKey: "cambridge-lower-secondary",
  },
  snapshot: {
    capturedAt: "2026-05-09T00:00:00.000Z",
    learning: {
      assetId: "asset:id:material:mathematics:vector:addition",
      contentId: "asset:id:material:mathematics:vector:addition",
      locale: "en",
      materialKey: "mathematics",
      section: "subject-lesson",
      slug: "subjects/mathematics/vector/addition",
      sourcePath: "material/lesson/mathematics/vector/addition",
      title: "Vector Addition",
      url: "https://nakafa.com/en/subjects/mathematics/vector/addition",
      verified: true,
    },
    placement: {
      mode: "placement",
      nodeKey: "curriculum:vector:addition",
      parentHref: "/en/curriculum/mathematics/vector",
      parentTitle: "Vector",
      programKey: "cambridge-lower-secondary",
    },
    source: "current-page",
    tools: {
      allowDeepResearch: true,
      allowMath: true,
      allowNakafa: true,
      allowPageFetch: true,
      evidenceScope: "verified-page",
    },
  },
  tools: {
    allowDeepResearch: true,
    allowMath: true,
    allowNakafa: true,
    allowPageFetch: true,
    evidenceScope: "verified-page",
  },
  transition: {
    reason: "page-context",
    toContextKey:
      "placement:cambridge-lower-secondary:curriculum:vector:addition:subjects/mathematics/vector/addition",
  },
} satisfies NinaContextPack;

describe("formatNinaContextPackPrompt", () => {
  it("formats canonical context without inventing asset or placement details", () => {
    const prompt = formatNinaContextPackPrompt(canonicalContext);

    expect(prompt).toContain("- verified: no");
    expect(prompt).toContain("- title: unknown");
    expect(prompt).toContain("- sourcePath: unknown");
    expect(prompt).toContain("Placement: canonical direct asset visit");
    expect(prompt).toContain("- Nakafa evidence allowed: no");
    expect(prompt).toContain("- evidence scope: general-learning");
  });

  it("formats verified placement context and allowed capability policy", () => {
    const prompt = formatNinaContextPackPrompt(placementContext);

    expect(prompt).toContain("- verified: yes");
    expect(prompt).toContain("- title: Vector Addition");
    expect(prompt).toContain("- mode: placement");
    expect(prompt).toContain("- parentTitle: Vector");
    expect(prompt).toContain("- current page fetch allowed: yes");
    expect(prompt).toContain("- evidence scope: verified-page");
  });
});
