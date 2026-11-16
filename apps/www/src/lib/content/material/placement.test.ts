import { describe, expect, it } from "@effect/vitest";
import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { CurriculumNodeKeySchema } from "@nakafa/aksara-contracts/program/curriculum";
import { LearningProgramKeySchema } from "@nakafa/aksara-contracts/program/spec";
import { Array as Arr, Option } from "effect";
import type { MaterialPlacement } from "@/lib/content/material/navigation";
import {
  createPlacementStore,
  findPlacement,
  keepPlacement,
  orderPlacements,
  placementHint,
  readLeadSubject,
  readPlacementAlignments,
  readPlacementTrails,
} from "@/lib/content/material/placement";

const place = (nodeKey: string): MaterialPlacement => ({
  context: {
    nodeKey: CurriculumNodeKeySchema.make(nodeKey),
    programKey: LearningProgramKeySchema.make("merdeka"),
  },
  hash: "functions",
  label: "Functions",
  parent: {
    publicPath: PublicPathSchema.make(
      "curriculum/merdeka/class-11/mathematics"
    ),
  },
  resolvedCanonicalPath: "subjects/mathematics/functions",
  trail: [],
});

/** A place under one curriculum, with the path that leads down to its subject. */
const placeIn = (programKey: string): MaterialPlacement => ({
  ...place("functions"),
  context: {
    nodeKey: CurriculumNodeKeySchema.make("functions"),
    programKey: LearningProgramKeySchema.make(programKey),
  },
  trail: [
    {
      label: `Curriculum ${programKey}`,
      publicPath: PublicPathSchema.make(`curriculum/${programKey}`),
    },
    {
      label: "Mathematics",
      publicPath: PublicPathSchema.make(
        `curriculum/${programKey}/class-11/mathematics`
      ),
    },
  ],
});

describe("lesson places in search", () => {
  it("leads with the curriculum that the catalog lists first, and puts an unlisted one last", () => {
    const ordered = orderPlacements(
      [placeIn("unlisted"), placeIn("cambridge"), placeIn("merdeka")],
      ["merdeka", "cambridge"]
    );

    expect(Arr.map(ordered, ({ context }) => context.programKey)).toStrictEqual(
      ["merdeka", "cambridge", "unlisted"]
    );
  });

  it("walks home down each place's curriculum pages, one trail per place", () => {
    expect(
      readPlacementTrails("en", "Home", [placeIn("merdeka"), placeIn("other")])
    ).toStrictEqual([
      [
        { name: "Home", path: "/en" },
        { name: "Curriculum merdeka", path: "/en/curriculum/merdeka" },
        {
          name: "Mathematics",
          path: "/en/curriculum/merdeka/class-11/mathematics",
        },
      ],
      [
        { name: "Home", path: "/en" },
        { name: "Curriculum other", path: "/en/curriculum/other" },
        {
          name: "Mathematics",
          path: "/en/curriculum/other/class-11/mathematics",
        },
      ],
    ]);
  });

  it("stands at home for a lesson that no curriculum places", () => {
    expect(readPlacementTrails("en", "Home", [])).toStrictEqual([
      [{ name: "Home", path: "/en" }],
    ]);
  });

  it("names the curriculum and unit of every place, and skips a place with no path", () => {
    expect(
      readPlacementAlignments("en", [placeIn("merdeka"), place("functions")])
    ).toStrictEqual([
      {
        framework: "Curriculum merdeka",
        path: "/en/curriculum/merdeka/class-11/mathematics#functions",
        target: "Functions",
      },
    ]);
  });

  it("names the level between a curriculum and its subject, when the trail has one", () => {
    const leveled: MaterialPlacement = {
      ...placeIn("merdeka"),
      trail: [
        {
          label: "Curriculum merdeka",
          publicPath: PublicPathSchema.make("curriculum/merdeka"),
        },
        {
          label: "Class 11",
          publicPath: PublicPathSchema.make("curriculum/merdeka/class-11"),
        },
        {
          label: "Mathematics",
          publicPath: PublicPathSchema.make(
            "curriculum/merdeka/class-11/mathematics"
          ),
        },
      ],
    };

    expect(readPlacementAlignments("en", [leveled])).toStrictEqual([
      {
        framework: "Curriculum merdeka",
        level: "Class 11",
        path: "/en/curriculum/merdeka/class-11/mathematics#functions",
        target: "Functions",
      },
    ]);
  });
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

describe("lesson title", () => {
  it("names the subject and level of the lead place, and none for a trail without a level or a lesson with no place", () => {
    const leveled: MaterialPlacement = {
      ...placeIn("merdeka"),
      trail: [
        {
          label: "Kurikulum Merdeka",
          publicPath: PublicPathSchema.make("kurikulum/merdeka"),
        },
        {
          label: "Kelas 12",
          publicPath: PublicPathSchema.make("kurikulum/merdeka/kelas-12"),
        },
        {
          label: "Matematika",
          publicPath: PublicPathSchema.make(
            "kurikulum/merdeka/kelas-12/matematika"
          ),
        },
      ],
    };

    expect(readLeadSubject([leveled, placeIn("cambridge")])).toStrictEqual(
      Option.some("Matematika Kelas 12")
    );
    expect(readLeadSubject([placeIn("merdeka")])).toStrictEqual(Option.none());
    expect(readLeadSubject([])).toStrictEqual(Option.none());
  });
});
