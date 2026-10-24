import { describe, expect, it } from "@effect/vitest";
import { schoolRewrite } from "@/lib/routing/school/rewrite";

/** The address of one request, as the router sees it. */
const at = (address: string) => new URL(address);

describe("school host rewrite of the input", () => {
  it.each([
    [
      "https://harapan.nakafa.com/",
      "https://harapan.nakafa.com/school/harapan",
    ],
    [
      "https://harapan.nakafa.com/exams?x=1",
      "https://harapan.nakafa.com/school/harapan/exams?x=1",
    ],
    [
      "http://harapan.localhost:3000/exams",
      "http://harapan.localhost:3000/school/harapan/exams",
    ],
    [
      "https://harapan.nakafa.com/api/ping",
      "https://harapan.nakafa.com/api/ping",
    ],
    ["https://www.nakafa.com/exams", "https://www.nakafa.com/exams"],
    ["https://nakafa.com/exams", "https://nakafa.com/exams"],
  ])("maps %s to %s", (address, routed) => {
    expect(schoolRewrite.input({ url: at(address) }).href).toBe(routed);
  });
});

describe("school host rewrite of the output", () => {
  it.each([
    [
      "https://nakafa.com/school/harapan/exams?x=1",
      "https://harapan.nakafa.com/exams?x=1",
    ],
    ["https://nakafa.com/school/harapan", "https://harapan.nakafa.com/"],
    [
      "http://harapan.localhost:3000/school/globex/exams",
      "http://globex.localhost:3000/exams",
    ],
    ["https://nakafa.com/school/new", "https://nakafa.com/school/new"],
    ["https://nakafa.com/school/a/exams", "https://nakafa.com/school/a/exams"],
    ["https://nakafa.com/en/curriculum", "https://nakafa.com/en/curriculum"],
    ["https://nakafa.com/school", "https://nakafa.com/school"],
    [
      "https://example.org/school/harapan",
      "https://example.org/school/harapan",
    ],
  ])("maps %s to %s", (routed, address) => {
    expect(schoolRewrite.output({ url: at(routed) }).href).toBe(address);
  });

  it("maps a school address back to the school tree", () => {
    const address = at("https://harapan.nakafa.com/exams/ujian?x=1");
    const routed = schoolRewrite.input({ url: address });
    expect(routed.href).toBe(
      "https://harapan.nakafa.com/school/harapan/exams/ujian?x=1"
    );
    expect(schoolRewrite.output({ url: routed }).href).toBe(address.href);
  });

  it.each([
    [
      "https://nakafa.com/school/harapan/exams/ujian?x=1",
      "https://harapan.nakafa.com/school/harapan/exams/ujian?x=1",
    ],
    [
      "https://nakafa.com/school/harapan",
      "https://harapan.nakafa.com/school/harapan",
    ],
    [
      "http://harapan.localhost:3000/school/harapan/exams",
      "http://harapan.localhost:3000/school/harapan/exams",
    ],
  ])("routes the school address of %s back to %s", (routed, routedInput) => {
    const address = schoolRewrite.output({ url: at(routed) });
    expect(schoolRewrite.input({ url: address }).href).toBe(routedInput);
  });
});
