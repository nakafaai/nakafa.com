// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { pinServerFunctionUrl } from "@/lib/deployment/pin";

const BASE = "https://nakafa.com";

describe("server function deployment pin", () => {
  it("adds the deployment to a server function path", () => {
    expect(pinServerFunctionUrl("/_serverFn/abc?x=1", "dpl_123", BASE)).toBe(
      "https://nakafa.com/_serverFn/abc?x=1&dpl=dpl_123"
    );
  });

  it("replaces a deployment the URL already names", () => {
    expect(
      pinServerFunctionUrl(
        "https://nakafa.com/_serverFn/abc?dpl=old",
        "new",
        BASE
      )
    ).toBe("https://nakafa.com/_serverFn/abc?dpl=new");
  });

  it("leaves the URL as it is without a deployment, as a local build has none", () => {
    expect(pinServerFunctionUrl("/_serverFn/abc", undefined, BASE)).toBe(
      "/_serverFn/abc"
    );
    expect(pinServerFunctionUrl("/_serverFn/abc", "", BASE)).toBe(
      "/_serverFn/abc"
    );
  });
});
