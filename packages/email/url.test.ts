import { assert, describe, it } from "@effect/vitest";
import { getPublicEmailUrl } from "@repo/email/url";

describe("email URLs", () => {
  it("derives canonical public URLs from the company identity", () => {
    assert.strictEqual(
      getPublicEmailUrl("/logo.png"),
      "https://nakafa.com/logo.png"
    );
  });
});
