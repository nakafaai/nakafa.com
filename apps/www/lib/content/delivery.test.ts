import { describe, expect, it } from "@effect/vitest";
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { Schema } from "effect";
import {
  publicContentHeaders,
  readContentCacheTags,
} from "@/lib/content/delivery";

const HASH = Schema.decodeSync(Sha256HashSchema)(`sha256:${"a".repeat(64)}`);

describe("publicContentHeaders", () => {
  it("sets the public document cache and joins the CDN tags", () => {
    expect(
      publicContentHeaders([
        "content-scope:article",
        `content-artifact:${HASH}`,
      ])
    ).toEqual({
      "Cache-Control":
        "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      "Vercel-Cache-Tag": `content-scope:article,content-artifact:${HASH}`,
    });
  });

  it("sends an empty tag header when a document has no tag", () => {
    expect(publicContentHeaders([])["Vercel-Cache-Tag"]).toBe("");
  });
});

describe("readContentCacheTags", () => {
  it("lists the scope tags before the artifact tags", () => {
    expect(readContentCacheTags(["article", "material"], [HASH])).toEqual([
      "content-scope:article",
      "content-scope:material",
      `content-artifact:${HASH}`,
    ]);
  });

  it("returns only scope tags when no artifact was read", () => {
    expect(readContentCacheTags(["material"])).toEqual([
      "content-scope:material",
    ]);
  });
});
