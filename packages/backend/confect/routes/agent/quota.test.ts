import { describe, expect, it } from "@effect/vitest";
import { AGENT_QUOTA_HEADERS } from "@repo/backend/confect/routes/agent/quota";

describe("public read quota", () => {
  it("names its policy in the IETF RateLimit-Policy field: 30 reads, full again 15 seconds after empty", () => {
    expect(AGENT_QUOTA_HEADERS).toStrictEqual({
      "RateLimit-Policy": '"public-read";q=30;w=15',
    });
  });
});
