import { describe, expect, it } from "@effect/vitest";
import {
  agentQuotaHeaders,
  readAgentQuota,
} from "@repo/backend/confect/routes/agent/quota";

describe("public read quota", () => {
  it("counts whole reads left and the seconds until the bucket is full", () => {
    expect(readAgentQuota(29)).toStrictEqual({
      remaining: 29,
      resetSeconds: 1,
    });
    expect(readAgentQuota(12.4)).toStrictEqual({
      remaining: 12,
      resetSeconds: 9,
    });
    expect(readAgentQuota(30)).toStrictEqual({
      remaining: 30,
      resetSeconds: 0,
    });
  });

  it("keeps a reading outside the bucket inside it", () => {
    expect(readAgentQuota(-0.5)).toStrictEqual({
      remaining: 0,
      resetSeconds: 15,
    });
    expect(readAgentQuota(31)).toStrictEqual({
      remaining: 30,
      resetSeconds: 0,
    });
  });

  it("writes the IETF RateLimit fields from the limiter's own size and refill", () => {
    expect(agentQuotaHeaders({ remaining: 28, resetSeconds: 1 })).toStrictEqual(
      {
        RateLimit: '"public-read";r=28;t=1',
        "RateLimit-Policy": '"public-read";q=30;w=15',
      }
    );
  });
});
