// @vitest-environment node
import { HttpClient } from "@confect/js";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import contents from "@repo/backend/confect/_generated/refs/contents";
import { NAKAFA_AGENT_DEFAULT_LIMIT } from "@repo/contents/agent/search";
import { Effect } from "effect";
import { readSearchHandler } from "@/lib/search/search.server";

process.env.VITE_CONVEX_URL = "https://example.convex.cloud";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("https://nakafa.com/"),
}));

// The read reaches Convex through one scripted query, which each test answers.
vi.mock("@/lib/convex/http", async () => {
  const { HttpClient: Client } = await import("@confect/js");
  const { Effect: Eff, Layer: Lay } = await import("effect");
  return {
    httpLayer: () =>
      Lay.effect(
        Client.HttpClient,
        Eff.map(Client.HttpClient, (client) => ({
          ...client,
          query: mocks.query,
        }))
      ).pipe(Lay.provide(Client.layer("https://example.convex.cloud"))),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("content search read", () => {
  it("reads the search of the locale for every viewer, with the query and the default limit", async () => {
    const item = { title: "Integral", url: "/en/integral" };
    mocks.query.mockReturnValue(Effect.succeed({ items: [item] }));

    const items = await readSearchHandler({
      data: { locale: "en", query: "integral" },
    });

    expect(mocks.query).toHaveBeenCalledWith(contents.queries.search.search, {
      limit: NAKAFA_AGENT_DEFAULT_LIMIT,
      locale: "en",
      offset: 0,
      queries: ["integral"],
    });
    expect(items).toStrictEqual([item]);
  });

  it("fails the request when the search read fails, rather than answering no results", async () => {
    mocks.query.mockReturnValue(
      Effect.fail(new HttpClient.HttpClientError({ cause: new Error("down") }))
    );

    await expect(
      readSearchHandler({ data: { locale: "en", query: "integral" } })
    ).rejects.toThrow();
  });
});
