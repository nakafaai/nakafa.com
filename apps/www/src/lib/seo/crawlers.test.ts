// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  renderTrainingCrawlerExpression,
  TRAINING_CRAWLERS,
} from "@/lib/seo/crawlers";

describe("renderTrainingCrawlerExpression", () => {
  it("blocks each refused user agent in lowercase and leaves out the robots-only token", () => {
    expect(renderTrainingCrawlerExpression(TRAINING_CRAWLERS)).toBe(
      '(lower(http.user_agent) contains "gptbot" or lower(http.user_agent) contains "claudebot" or lower(http.user_agent) contains "ccbot" or lower(http.user_agent) contains "bytespider" or lower(http.user_agent) contains "meta-externalagent" or lower(http.user_agent) contains "amazonbot")'
    );
  });
});
