// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  serveAgentSkills,
  serveLlmsIndex,
  serveLlmsMarkdown,
  serveSkill,
} from "@/lib/llms/serve.server";
import { getNakafaSkillText } from "@/lib/llms/skill";

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const getLlmsMarkdownTextMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/llms/content/markdown", () => ({
  /** Controls which route has a page source. */
  getLlmsMarkdownText: getLlmsMarkdownTextMock,
}));

vi.mock("@/lib/llms/index/generate", () => ({
  /** Controls section indexes; none exist for these routes. */
  getLlmsSectionIndexText: () => Effect.succeed(null),
}));

describe("llms index endpoint", () => {
  it("serves the root index as markdown that varies by Accept", async () => {
    const response = serveLlmsIndex();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/markdown; charset=utf-8"
    );
    expect(response.headers.get("vary")).toBe("Accept");
    expect(response.headers.get("cache-control")).toContain("s-maxage");
    await expect(response.text()).resolves.toContain("Nakafa");
  });
});

describe("skill endpoint", () => {
  it("serves the Nakafa skill guide as markdown", async () => {
    const response = serveSkill();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/markdown; charset=utf-8"
    );
    await expect(response.text()).resolves.toBe(getNakafaSkillText());
  });
});

describe("agent skills endpoint", () => {
  it("serves the discovery manifest with the digest of the skill", async () => {
    const response = await serveAgentSkills();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");
    await expect(response.json()).resolves.toMatchObject({
      skills: [{ digest: expect.stringMatching(DIGEST_PATTERN) }],
    });
  });
});

describe("markdown endpoint", () => {
  it("answers the page source of the splat path", async () => {
    getLlmsMarkdownTextMock.mockReturnValue(Effect.succeed("# Article"));

    const response = await serveLlmsMarkdown({
      params: { _splat: "en/articles/belajar" },
    });

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("# Article");
    expect(getLlmsMarkdownTextMock).toHaveBeenCalledWith({
      cleanSlug: "articles/belajar",
      locale: "en",
    });
  });

  it("answers not found for a path without a splat", async () => {
    getLlmsMarkdownTextMock.mockReturnValue(Effect.succeed(null));

    const response = await serveLlmsMarkdown({ params: {} });

    expect(response.status).toBe(404);
    expect(getLlmsMarkdownTextMock).toHaveBeenCalledWith({
      cleanSlug: "",
      locale: "en",
    });
  });

  it("ignores empty segments of the splat", async () => {
    getLlmsMarkdownTextMock.mockReturnValue(Effect.succeed("# Quran"));

    const response = await serveLlmsMarkdown({
      params: { _splat: "id//quran/1/" },
    });

    await expect(response.text()).resolves.toBe("# Quran");
    expect(getLlmsMarkdownTextMock).toHaveBeenCalledWith({
      cleanSlug: "quran/1",
      locale: "id",
    });
  });
});
