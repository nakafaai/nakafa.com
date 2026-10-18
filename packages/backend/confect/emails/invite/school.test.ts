import { describe, expect, it } from "@effect/vitest";
import { schoolAddress } from "@repo/backend/confect/emails/invite/school";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

const harapan = Schema.decodeSync(TenantSlug)("harapan");

describe("emails/invite/school", () => {
  it("answers the school's own host under the site's domain", () => {
    expect(schoolAddress(new URL("https://nakafa.com"), harapan)).toBe(
      "https://harapan.nakafa.com/"
    );
  });

  it("keeps the protocol and the port of a local run", () => {
    expect(schoolAddress(new URL("http://localhost:3000"), harapan)).toBe(
      "http://harapan.localhost:3000/"
    );
  });

  it("answers the root of the host, whatever path the site URL carries", () => {
    expect(schoolAddress(new URL("https://nakafa.com/en/"), harapan)).toBe(
      "https://harapan.nakafa.com/"
    );
  });
});
