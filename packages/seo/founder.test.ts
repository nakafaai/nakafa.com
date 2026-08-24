import {
  FOUNDER_IDENTITY,
  FOUNDER_SOCIAL_PROFILE_URLS,
  FounderIdentitySchema,
} from "@repo/seo/founder";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

const decodeFounderIdentity = Schema.decodeUnknownSync(FounderIdentitySchema);

describe("founder identity", () => {
  it("decodes the public contributor identity and verified profiles", () => {
    expect(decodeFounderIdentity(FOUNDER_IDENTITY)).toEqual(FOUNDER_IDENTITY);
    expect(FOUNDER_SOCIAL_PROFILE_URLS).toEqual([
      "https://github.com/nabilfatih",
      "https://www.linkedin.com/in/nabilfatih",
      "https://x.com/nabilfatih_",
    ]);
  });
});
