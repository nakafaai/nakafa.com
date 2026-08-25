import { NAKAFA_OPENAPI_ETAG } from "@repo/backend/agent/openapi/document";
import { describe, expect, it } from "vitest";
import { GET, OPTIONS } from "./route";

describe("root OpenAPI route", () => {
  it("serves the backend-owned OpenAPI bytes", async () => {
    const response = GET(new Request("https://nakafa.com/openapi.json"));

    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).toBe(NAKAFA_OPENAPI_ETAG);
    await expect(response.json()).resolves.toMatchObject({
      info: { title: "Nakafa Public API" },
      openapi: "3.1.1",
    });
  });

  it("revalidates and responds to CORS preflight", () => {
    const revalidated = GET(
      new Request("https://nakafa.com/openapi.json", {
        headers: { "if-none-match": NAKAFA_OPENAPI_ETAG },
      })
    );

    expect(revalidated.status).toBe(304);
    expect(OPTIONS().status).toBe(204);
  });
});
