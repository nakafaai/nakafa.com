// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { readFeaturedTryout } from "@/components/tryout/catalog/source.server";
import {
  readRuntimeCurriculumCatalog,
  readRuntimeCurriculumOptions,
} from "@/lib/curriculum/model";
import {
  readHomeCurriculaHandler,
  readHomeTryoutHandler,
} from "@/lib/marketing/home.server";

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("https://nakafa.com/en"),
}));

vi.mock("@/components/tryout/catalog/source.server", () => ({
  readFeaturedTryout: vi.fn(() => Promise.resolve({ title: "Featured" })),
}));

vi.mock("@/lib/curriculum/model", () => ({
  readRuntimeCurriculumCatalog: vi.fn(() =>
    Promise.resolve({ entries: [], sourceRevision: "rev" })
  ),
  readRuntimeCurriculumOptions: vi.fn(() => [
    { href: "/en/curricula/math", title: "Math", value: "math" },
  ]),
}));

describe("home page try-out", () => {
  it("reads the featured try-out of the requested locale", async () => {
    const value = await readHomeTryoutHandler({ data: { locale: "de" } });
    expect(value).toStrictEqual({ title: "Featured" });
    expect(readFeaturedTryout).toHaveBeenCalledWith("de");
  });

  it("lists the curricula of the requested locale from the signed catalog", async () => {
    const options = await readHomeCurriculaHandler({ data: { locale: "en" } });
    expect(options).toStrictEqual([
      { href: "/en/curricula/math", title: "Math", value: "math" },
    ]);
    expect(readRuntimeCurriculumCatalog).toHaveBeenCalledWith("en");
    expect(readRuntimeCurriculumOptions).toHaveBeenCalledWith(
      { entries: [], sourceRevision: "rev" },
      "en"
    );
  });
});
