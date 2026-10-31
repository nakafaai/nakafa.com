import { describe, expect, it } from "@effect/vitest";
import { CurriculumNodeKeySchema } from "@nakafa/aksara-contracts/program/curriculum";
import { LearningProgramKeySchema } from "@nakafa/aksara-contracts/program/spec";
import { Option } from "effect";
import type { MaterialPlacement } from "@/lib/content/material/navigation";
import {
  createPlacementStore,
  findPlacement,
  keepPlacement,
  placementHint,
} from "@/lib/content/material/placement";

const place = (nodeKey: string): MaterialPlacement => ({
  context: {
    nodeKey: CurriculumNodeKeySchema.make(nodeKey),
    programKey: LearningProgramKeySchema.make("merdeka"),
  },
  hash: "functions",
  label: "Functions",
  parent: { publicPath: "curriculum/merdeka/class-11/mathematics" },
  resolvedCanonicalPath: "subjects/mathematics/functions",
  trail: [],
});

describe("lesson placement", () => {
  it("finds the place that the reader's hint names among the places of the lesson", () => {
    const places = [place("class-10"), place("class-11")];

    expect(placementHint(place("class-11"))).toBe("merdeka~class-11");
    expect(findPlacement(places, "merdeka~class-11")).toEqual(
      Option.some(place("class-11"))
    );
  });

  it("finds nothing for a hint the release does not hold, or for no hint", () => {
    const places = [place("class-10")];

    expect(findPlacement(places, "merdeka~forged")).toEqual(Option.none());
    expect(findPlacement(places, undefined)).toEqual(Option.none());
  });

  it("starts empty, as the static page renders it, and keeps what the address names", () => {
    const store = createPlacementStore();
    expect(store.getState().placement).toEqual(Option.none());

    keepPlacement(store, Option.some(place("class-10")));
    expect(store.getState().placement).toEqual(Option.some(place("class-10")));

    keepPlacement(store, Option.none());
    expect(store.getState().placement).toEqual(Option.none());
  });
});
