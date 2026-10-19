import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { Effect } from "effect";
import {
  BrowserQueryFailed,
  readBrowserQuery,
  readServerQuery,
} from "@/lib/data/load";

process.env.VITE_CONVEX_URL = "https://example.convex.cloud";

const browser = vi.hoisted(() => ({
  query: vi.fn<(reference: unknown, args: unknown) => Promise<unknown>>(),
}));

vi.mock("@confect/core/Ref", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@confect/core/Ref")>()),
  getFunctionReference: () => "reference",
}));

const preload = vi.hoisted(() => ({
  read: vi.fn<(...args: unknown[]) => unknown>(),
}));

vi.mock("@/lib/convex/client.client", () => ({
  readConvexClient: () => ({ query: browser.query }),
}));

vi.mock("@/lib/data/preload.server", () => ({
  preloadConfectQuery: (...args: unknown[]) => {
    preload.read(...args);
    return Effect.succeed([{ alignmentId: "server" }]);
  },
}));

const ref = refs.public.contents.queries.recent.getRecentlyViewed;

describe("route loader", () => {
  it("reads the query with the request's token through the server preload", async () => {
    const value = await readServerQuery(ref, { locale: "en" }, "token-ada");
    expect(value).toStrictEqual([{ alignmentId: "server" }]);
    expect(preload.read).toHaveBeenCalledWith(
      ref,
      { locale: "en" },
      "token-ada"
    );
  });

  it("reads the query once through the shared browser client", async () => {
    browser.query.mockResolvedValueOnce([]);
    await expect(
      readBrowserQuery(ref, { locale: "en" })
    ).resolves.toStrictEqual([]);
    expect(browser.query).toHaveBeenCalledTimes(1);
    expect(browser.query).toHaveBeenCalledWith("reference", { locale: "en" });
  });

  it("rejects a browser value that the query's Schema refuses", async () => {
    browser.query.mockResolvedValueOnce("not a list of rows");
    await expect(readBrowserQuery(ref, { locale: "en" })).rejects.toMatchObject(
      { _tag: "SchemaError" }
    );
  });

  it("names a refused browser read as a BrowserQueryFailed", async () => {
    const cause = new Error("offline");
    browser.query.mockRejectedValueOnce(cause);
    await expect(readBrowserQuery(ref, { locale: "en" })).rejects.toStrictEqual(
      new BrowserQueryFailed({ cause })
    );
  });
});
