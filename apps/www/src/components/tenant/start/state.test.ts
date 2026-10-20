import { describe, expect, it } from "@effect/vitest";
import { SchoolName, UnitName } from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Option, Schema, Struct } from "effect";
import {
  applyAnswer,
  chosenLevels,
  resumeItem,
  START_NAME_LIMIT,
  type StartDraft,
  startRequest,
  suggestSlug,
  typedSlug,
  unitName,
} from "@/components/tenant/start/state";

const harapan = Schema.decodeSync(TenantSlug)("harapan");

/** A draft that answers every question for a school in Makassar. */
const full: NonNullable<StartDraft> = {
  country: "ID",
  levels: ["smp", "sd"],
  name: "Harapan Bangsa",
  role: "teacher",
  size: "m",
  slug: harapan,
  updatedAt: 1,
};

describe("school start state", () => {
  it("applies each answer over the draft as the server saves it", () => {
    const named = applyAnswer(
      null,
      { kind: "name", name: "Harapan Bangsa", slug: harapan },
      5
    );
    expect(named).toEqual({
      name: "Harapan Bangsa",
      slug: "harapan",
      updatedAt: 5,
    });
    expect(applyAnswer(named, { kind: "levels", value: ["sd"] }, 6)).toEqual({
      levels: ["sd"],
      name: "Harapan Bangsa",
      slug: "harapan",
      updatedAt: 6,
    });
  });

  it("resumes at the first question the draft leaves open", () => {
    expect(resumeItem(null)).toBe("name");
    expect(resumeItem({ name: "Harapan", updatedAt: 1 })).toBe("name");
    expect(resumeItem(Struct.omit(full, ["country"]))).toBe("country");
    expect(resumeItem({ ...full, levels: [] })).toBe("levels");
    expect(resumeItem(Struct.omit(full, ["role"]))).toBe("role");
    expect(resumeItem(Struct.omit(full, ["size"]))).toBe("size");
    expect(resumeItem(full)).toBe("size");
  });

  it("keeps only the levels the country offers, in its order", () => {
    expect(chosenLevels(full)).toEqual(["sd", "smp"]);
    expect(
      chosenLevels({ ...full, country: "DE", levels: ["mi", "sd"] })
    ).toEqual(["sd"]);
    expect(chosenLevels(Struct.omit(full, ["country"]))).toEqual([]);
    expect(chosenLevels(Struct.omit(full, ["levels"]))).toEqual([]);
  });

  it("takes the longest school name, and a unit named with a level label stays within the unit name", () => {
    const longest = "A".repeat(START_NAME_LIMIT);
    expect(Schema.is(SchoolName)(longest)).toBe(true);
    expect(Schema.is(SchoolName)(`${longest}A`)).toBe(false);
    expect(Schema.is(UnitName)(longest)).toBe(true);
    expect(Schema.is(UnitName)(`${longest} Sekundarstufe II`)).toBe(true);
  });

  it("names units the way the school's country writes them", () => {
    const compose = (level: string, name: string) => `${name} ${level}`;
    expect(unitName("ID", "SMA", "Harapan", compose)).toBe("SMA Harapan");
    expect(unitName("GB", "Primary", "Harapan", compose)).toBe(
      "Harapan Primary"
    );
  });

  it("builds the opening from a complete draft, one unit per level", () => {
    const name = (level: string, school: string) => `${level} ${school}`;
    expect(startRequest(full, "Asia/Makassar", name)).toEqual(
      Option.some({
        country: "ID",
        name: "Harapan Bangsa",
        role: "teacher",
        size: "m",
        slug: "harapan",
        timeZone: "Asia/Makassar",
        units: [
          { level: "sd", name: "sd Harapan Bangsa" },
          { level: "smp", name: "smp Harapan Bangsa" },
        ],
      })
    );
    expect(
      Option.map(
        startRequest({ ...full, levels: ["sma"] }, "Asia/Jakarta", name),
        (request) => request.units
      )
    ).toEqual(Option.some([{ level: "sma", name: "Harapan Bangsa" }]));
    expect(startRequest(null, "Asia/Jakarta", name)).toEqual(Option.none());
    expect(
      startRequest(Struct.omit(full, ["size"]), "Asia/Jakarta", name)
    ).toEqual(Option.none());
  });

  it("suggests an address from the name", () => {
    expect(suggestSlug("SMA Harapan Bangsa")).toBe("sma-harapan-bangsa");
    expect(suggestSlug("  Grundschule Am Mühlbach! ")).toBe(
      "grundschule-am-muhlbach"
    );
    expect(suggestSlug(`${"a".repeat(62)} b`)).toBe("a".repeat(62));
    expect(suggestSlug("!!!")).toBe("");
  });

  it("keeps a typed address to what a slug holds", () => {
    expect(typedSlug("Harapan Baru_2")).toBe("harapan-baru-2");
    expect(typedSlug("Héllo.world")).toBe("helloworld");
  });
});
