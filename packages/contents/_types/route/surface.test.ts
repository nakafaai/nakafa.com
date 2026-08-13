import {
  PUBLIC_ROUTE_SURFACES,
  readNamespaceSegment,
} from "@repo/contents/_types/route/surface";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("public route surfaces", () => {
  it("reads the localized namespace owned by one route surface", () => {
    expect(readNamespaceSegment("subject", "en")).toBe("subjects");
    expect(readNamespaceSegment("subject", "id")).toBe("materi");
  });

  it("returns no namespace when its decoded surface is absent", () => {
    vi.spyOn(PUBLIC_ROUTE_SURFACES, "find").mockReturnValueOnce(undefined);

    expect(readNamespaceSegment("subject", "id")).toBeUndefined();
  });
});
