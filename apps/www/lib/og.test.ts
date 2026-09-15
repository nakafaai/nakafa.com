// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { generateFallbackImage } from "@/lib/og";

const mocks = vi.hoisted(() => {
  const imageCalls: Array<{ element: unknown; options: unknown }> = [];

  class FakeImageResponse {
    readonly element: unknown;
    readonly headers = new Headers({ "content-type": "image/png" });

    constructor(element: unknown, options?: unknown) {
      this.element = element;
      imageCalls.push({ element, options });
    }

    arrayBuffer() {
      return Promise.resolve(new ArrayBuffer(8));
    }
  }

  return {
    cacheLife: vi.fn(),
    FakeImageResponse,
    getTranslations: vi.fn(),
    imageCalls,
    readFile: vi.fn(),
  };
});

vi.mock("node:fs/promises", () => ({ readFile: mocks.readFile }));
vi.mock("next/cache", () => ({ cacheLife: mocks.cacheLife }));
vi.mock("next-intl/server", () => ({
  getTranslations: mocks.getTranslations,
}));
vi.mock("takumi-js/response", () => ({
  ImageResponse: mocks.FakeImageResponse,
}));
vi.mock("@/lib/og/image", () => ({ OgImage: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.imageCalls.length = 0;
  mocks.readFile.mockResolvedValue("<svg/>");
  mocks.getTranslations.mockImplementation(() =>
    Promise.resolve((key: string) => `NotFound.${key}`)
  );
});

describe("fallback social image", () => {
  it("answers unknown slugs with translated brand artwork", async () => {
    const response = await generateFallbackImage("de");

    expect(mocks.getTranslations).toHaveBeenCalledWith({
      locale: "de",
      namespace: "NotFound",
    });
    expect(mocks.imageCalls).toHaveLength(1);
    const [{ element, options }] = mocks.imageCalls as [
      {
        element: { props: Record<string, unknown> };
        options: { height: number; width: number };
      },
    ];
    expect(element.props).toMatchObject({
      description: "NotFound.description",
      title: "NotFound.title",
    });
    expect(options).toMatchObject({ height: 630, width: 1200 });
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe("image/png");
  });
});
