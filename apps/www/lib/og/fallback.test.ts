// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import { generateOGImage } from "@/lib/og";
import { generateFallbackImage } from "@/lib/og/fallback";
import { OG_FALLBACK_HEADERS, OG_IMAGE_HEADERS } from "@/lib/og/headers";

const ImageCallSchema = Schema.Struct({
  element: Schema.Unknown,
  options: Schema.Unknown,
});

const mocks = vi.hoisted(() => {
  let imageCalls: (typeof ImageCallSchema.Type)[] = [];

  class FakeImageResponse {
    readonly element: unknown;
    readonly headers = new Headers({ "content-type": "image/png" });

    constructor(element: unknown, options?: unknown) {
      this.element = element;
      imageCalls = [...imageCalls, { element, options }];
    }

    arrayBuffer() {
      return Promise.resolve(new ArrayBuffer(8));
    }
  }

  return {
    FakeImageResponse,
    readServerTranslator: vi.fn(),
    get imageCalls() {
      return imageCalls;
    },
    readFile: vi.fn(),
  };
});

vi.mock("node:fs/promises", () => ({ readFile: mocks.readFile }));
vi.mock("@repo/internationalization/src/translator", () => ({
  readServerTranslator: mocks.readServerTranslator,
}));
vi.mock("takumi-js/response", () => ({
  ImageResponse: mocks.FakeImageResponse,
}));
vi.mock("@/lib/og/image", () => ({ OgImage: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.imageCalls.length = 0;
  mocks.readFile.mockResolvedValue("<svg/>");
  mocks.readServerTranslator.mockImplementation(() =>
    Promise.resolve((key: string) => `NotFound.${key}`)
  );
});

describe("fallback social image", () => {
  it("answers unknown slugs with translated brand artwork", async () => {
    const response = await generateFallbackImage("de");

    expect(mocks.readServerTranslator).toHaveBeenCalledWith({
      locale: "de",
      namespace: "NotFound",
    });
    expect(mocks.imageCalls).toHaveLength(1);
    const [{ element, options }] = mocks.imageCalls;
    expect(element).toMatchObject({
      props: {
        description: "NotFound.description",
        title: "NotFound.title",
      },
    });
    expect(options).toMatchObject({
      headers: OG_FALLBACK_HEADERS,
      height: 630,
      width: 1200,
    });
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe("image/png");
  });

  it("gives the image of a known route the CDN headers unless the caller names others", async () => {
    await generateOGImage({ description: "Lesson", title: "Function" });

    const [{ options }] = mocks.imageCalls;
    expect(options).toMatchObject({ headers: OG_IMAGE_HEADERS });
    expect(options).not.toMatchObject({ headers: OG_FALLBACK_HEADERS });
  });
});
