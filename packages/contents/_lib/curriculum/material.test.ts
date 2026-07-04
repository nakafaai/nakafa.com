import { BulbIcon, PiIcon } from "@hugeicons/core-free-icons";
import {
  getCurrentMaterial,
  getMaterialIcon,
  getMaterials,
} from "@repo/contents/_lib/curriculum/material";
import type { MaterialList } from "@repo/contents/_types/curriculum/material";
import {
  EXERCISES_MATERIALS,
  SUBJECT_MATERIALS,
} from "@repo/contents/_types/taxonomy";
import { Effect, Option } from "effect";
import { describe, expect, it } from "vitest";

const materialList: MaterialList = [
  {
    description: "Chapter description",
    href: "/chapter-one",
    items: [
      {
        href: "/chapter-one/lesson-one",
        title: "Lesson One",
      },
    ],
    title: "Chapter One",
  },
];

describe("getMaterials", () => {
  it("loads localized material navigation and normalizes leading slashes", () => {
    const idMaterials = Effect.runSync(
      getMaterials("/material/lesson/mathematics/exponential-logarithm", "id")
    );
    const enMaterials = Effect.runSync(
      getMaterials("material/lesson/mathematics/exponential-logarithm", "en")
    );

    expect(idMaterials[0]?.title).toBe("Eksponen dan Logaritma");
    expect(enMaterials[0]?.title).toBe("Exponents and Logarithms");
  });
});

describe("getMaterialIcon", () => {
  it("resolves mathematics to the pi icon", () => {
    expect(getMaterialIcon("mathematics")).toBe(PiIcon);
  });

  it("resolves every known material domain without the fallback icon", () => {
    for (const material of [...SUBJECT_MATERIALS, ...EXERCISES_MATERIALS]) {
      expect(getMaterialIcon(material)).not.toBe(BulbIcon);
    }
  });

  it("uses the fallback icon for unknown material domains", () => {
    expect(getMaterialIcon("unknown-material")).toBe(BulbIcon);
  });
});

describe("getCurrentMaterial", () => {
  it("matches the active chapter", () => {
    const currentMaterial = getCurrentMaterial("chapter-one", materialList);

    expect(Option.getOrUndefined(currentMaterial.currentChapter)).toBe(
      materialList[0]
    );
    expect(Option.isNone(currentMaterial.currentItem)).toBe(true);
  });

  it("matches the active item and its parent chapter", () => {
    const currentMaterial = getCurrentMaterial(
      "/chapter-one/lesson-one",
      materialList
    );

    expect(Option.getOrUndefined(currentMaterial.currentChapter)).toBe(
      materialList[0]
    );
    expect(Option.getOrUndefined(currentMaterial.currentItem)).toBe(
      materialList[0]?.items[0]
    );
  });

  it("returns empty options when the path is outside the material list", () => {
    const currentMaterial = getCurrentMaterial("missing", materialList);

    expect(Option.isNone(currentMaterial.currentChapter)).toBe(true);
    expect(Option.isNone(currentMaterial.currentItem)).toBe(true);
  });
});
