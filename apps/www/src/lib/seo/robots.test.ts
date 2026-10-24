// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { renderRobotsTxt } from "@/lib/seo/robots";

describe("renderRobotsTxt", () => {
  it("allows every crawler and disallows only the refused training tokens", () => {
    expect(renderRobotsTxt()).toBe(
      Arr.join(
        [
          "# Nakafa content is licensed under https://github.com/nakafaai/aksara/blob/main/CONTENT_LICENSE.md",
          "# Search engines, AI answer services and user-requested fetches may read and cite every page.",
          "# Model training is reserved: https://nakafa.com/.well-known/tdmrep.json",
          "",
          "User-Agent: *",
          "Content-Signal: search=yes, ai-input=yes, ai-train=no",
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
});
