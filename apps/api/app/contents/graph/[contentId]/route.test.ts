import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("retired content graph API route", () => {
  it("returns an explicit successor instead of changing the legacy schema", async () => {
    const contentId = "asset:en:article:politics:article:example";
    const response = await GET(
      new Request(`http://localhost/contents/graph/${contentId}`),
      { params: Promise.resolve({ contentId }) }
    );
    const successor = `/contents/reference/${encodeURIComponent(contentId)}`;

    expect(response.status).toBe(410);
    expect(response.headers.get("Link")).toBe(
      `<${successor}>; rel="successor-version"`
    );
    expect(await response.json()).toEqual({
      error: "The legacy content graph contract has been retired.",
      successor,
    });
  });
});
