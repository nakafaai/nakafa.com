// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  casFrontExposure,
  NAKAFA_ZONE,
  productionHostExposure,
  webExposure,
  workerName,
} from "#www/deploy/stage";

describe("workerName", () => {
  it("names a production Worker after its service alone", () => {
    expect(workerName("web", "prod")).toBe("nakafa-web");
    expect(workerName("cas-engine", "prod")).toBe("nakafa-cas-engine");
  });

  it("suffixes every other stage, so stages never share a Worker", () => {
    expect(workerName("web", "staging")).toBe("nakafa-web-staging");
    expect(workerName("cas", "pr-42")).toBe("nakafa-cas-pr-42");
  });
});

describe("webExposure", () => {
  it("serves production on the apex and every School host, with workers.dev off", () => {
    expect(webExposure("prod")).toEqual({
      domain: { name: NAKAFA_ZONE, zoneName: NAKAFA_ZONE },
      routes: [{ pattern: "*.nakafa.com/*", zoneName: NAKAFA_ZONE }],
      workersDev: false,
    });
  });

  it("serves staging on one host behind Access for the owner accounts only", () => {
    const exposure = webExposure("staging");

    expect(exposure.domain).toBeUndefined();
    expect(exposure.routes).toEqual([
      { pattern: "staging.nakafa.com/*", zoneName: NAKAFA_ZONE },
    ]);
    expect(exposure.workersDev).toBe(false);
    expect(exposure.access).toEqual({
      name: "nakafa-web-staging",
      policies: [
        {
          decision: "allow",
          include: [
            { email: "nabilakbarazzima@gmail.com" },
            { email: "nakafaai@gmail.com" },
          ],
        },
      ],
    });
  });

  it("gives every other stage only its workers.dev URL", () => {
    expect(webExposure("pr-42")).toEqual({ routes: [], workersDev: true });
  });
});

describe("casFrontExposure", () => {
  it("serves production on cas.nakafa.com with workers.dev off", () => {
    expect(casFrontExposure("prod")).toEqual({
      routes: [{ pattern: "cas.nakafa.com/*", zoneName: NAKAFA_ZONE }],
      workersDev: false,
    });
  });

  it("gives a probe stage only its workers.dev URL and no zone route", () => {
    expect(casFrontExposure("cas-probe")).toEqual({
      routes: [],
      workersDev: true,
    });
  });
});

describe("productionHostExposure", () => {
  it("routes one exact production host and keeps workers.dev off", () => {
    expect(productionHostExposure("api.nakafa.com")).toEqual({
      routes: [{ pattern: "api.nakafa.com/*", zoneName: NAKAFA_ZONE }],
      workersDev: false,
    });
  });
});
