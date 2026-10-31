// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { renderRobotsTxt } from "@/lib/seo/robots";

/** The directives that Lighthouse's robots.txt audit knows; any other line fails the SEO audit. */
const KNOWN_ROBOTS_DIRECTIVES = [
  "user-agent",
  "disallow",
  "allow",
  "sitemap",
  "crawl-delay",
  "clean-param",
  "host",
  "request-rate",
  "visit-time",
  "noindex",
];

describe("renderRobotsTxt", () => {
  it("allows every crawler, Google-Extended included, and disallows only the refused training tokens", () => {
    expect(renderRobotsTxt()).toBe(
      Arr.join(
        [
          "# Nakafa content is licensed under https://github.com/nakafaai/aksara/blob/main/CONTENT_LICENSE.md",
          "# Search engines, AI answer services and user-requested fetches may read and cite every page.",
          "# Model training is reserved: https://nakafa.com/.well-known/tdmrep.json",
          "# The crawlers below that only train are refused.",
          "# Google-Extended stays allowed, because Google reads that one token for Gemini grounding as well as for training.",
          "",
          "User-Agent: *",
          "Allow: /",
          "",
          "User-Agent: GPTBot",
          "User-Agent: ClaudeBot",
          "User-Agent: CCBot",
          "User-Agent: Bytespider",
          "User-Agent: meta-externalagent",
          "User-Agent: Amazonbot",
          "User-Agent: Applebot-Extended",
          "Disallow: /",
          "",
          "Sitemap: https://nakafa.com/sitemap.xml",
          "",
        ],
        "\n"
      )
    );
  });

  it("writes only comments and the directives that robots.txt parsers know", () => {
    const directives = Arr.filter(
      renderRobotsTxt().split("\n"),
      (line) => line !== "" && !line.startsWith("#")
    );
    const unknown = Arr.filter(
      directives,
      (line) =>
        !Arr.contains(
          KNOWN_ROBOTS_DIRECTIVES,
          line.slice(0, line.indexOf(":")).toLowerCase()
        )
    );

    expect(unknown).toEqual([]);
  });
});
