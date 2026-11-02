// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import {
  renderTrainingCrawlerExpression,
  TRAINING_CRAWLERS,
} from "@/lib/seo/crawlers";

/** Whether the edge rule refuses a user agent, by the text each crawler sends. */
const refused = (agent: string) =>
  Arr.some(
    Arr.flatMap(TRAINING_CRAWLERS, (crawler) => crawler.sentAs),
    (text) => agent.toLowerCase().includes(text)
  );

describe("renderTrainingCrawlerExpression", () => {
  it("blocks each refused user agent in lowercase and leaves out the robots-only token", () => {
    expect(renderTrainingCrawlerExpression(TRAINING_CRAWLERS)).toBe(
      '(lower(http.user_agent) contains "gptbot" or lower(http.user_agent) contains "claudebot/" or lower(http.user_agent) contains "ccbot" or lower(http.user_agent) contains "bytespider" or lower(http.user_agent) contains "meta-externalagent" or lower(http.user_agent) contains "amazonbot")'
    );
  });
});

describe("TRAINING_CRAWLERS", () => {
  // These are the user agents that Cloudflare's logs show on 1 November 2026.
  it.each([
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +claudebot@anthropic.com)",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-SearchBot/1.0; +claudebot@anthropic.com)",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot",
    "Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  ])("lets %s read and cite", (agent) => {
    expect(refused(agent)).toBe(false);
  });

  it.each([
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
    "ClaudeBot/1.0",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.4; +https://openai.com/gptbot",
  ])("refuses %s", (agent) => {
    expect(refused(agent)).toBe(true);
  });
});
