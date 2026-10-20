// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Record } from "effect";
import { schoolRootHandler } from "@/lib/tenant/root.server";

process.env.VITE_CONVEX_URL = "https://example.convex.cloud";

const mocks = vi.hoisted(() => ({
  headers: new Headers(),
  setResponseHeader: vi.fn<(name: string, value: string) => void>(),
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("https://harapan.nakafa.com/"),
  getRequestHeaders: () => mocks.headers,
  setResponseHeader: mocks.setResponseHeader,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("school root", () => {
  it("answers the negotiated locale, its school messages and the request instant", async () => {
    mocks.headers = new Headers({ "accept-language": "id-ID,en;q=0.5" });

    const answer = await schoolRootHandler({ data: undefined });

    expect(answer.locale).toBe("id");
    expect(answer.now).toBeInstanceOf(Date);
    expect(Record.keys(answer.messages)).toStrictEqual(
      expect.arrayContaining(["School", "SchoolSettings", "Exams", "Common"])
    );
    expect(mocks.setResponseHeader).toHaveBeenCalledExactlyOnceWith(
      "cache-control",
      "private, no-store"
    );
  });
});
