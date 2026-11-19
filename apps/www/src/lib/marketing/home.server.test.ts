// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  readRuntimeCurriculumCatalog,
  readRuntimeCurriculumOptions,
} from "@/lib/curriculum/model";
import { readHomeCurriculaHandler } from "@/lib/marketing/home.server";

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("https://nakafa.com/en"),
}));

vi.mock("@/lib/curriculum/model", () => ({
  readRuntimeCurriculumCatalog: vi.fn(() =>
    Effect.succeed({ entries: [], sourceRevision: "rev" })
  ),
  readRuntimeCurriculumOptions: vi.fn(() => [
    { href: "/en/curricula/math", title: "Math", value: "math" },
  ]),
}));

describe("home page curriculum", () => {
  it("lists the curricula of the requested locale from the signed catalog", async () => {
    const options = await readHomeCurriculaHandler({ data: { locale: "en" } });
    expect(options).toStrictEqual([
      { href: "/en/curricula/math", title: "Math", value: "math" },
    ]);
    expect(readRuntimeCurriculumCatalog).toHaveBeenCalledWith("en");
    expect(readRuntimeCurriculumOptions).toHaveBeenCalledWith({
      entries: [],
      sourceRevision: "rev",
    });
  });
});
