import { describe, expect, it } from "@effect/vitest";
import { AssetAddress } from "@repo/backend/confect/exams/asset";
import {
  matchAnswers,
  newChoiceAnswers,
  shortAnswers,
  tableAnswers,
} from "@repo/backend/confect/exams/blank";
import { Array as Arr, Schema } from "effect";
import {
  addressesOf,
  partLabels,
  pictureIdsOfDocuments,
} from "@/components/exams/sitting/pictures";

/** A document of the assessment editor that holds one image, which names its asset. */
const withPicture = (asset: string) => ({
  content: [
    { attrs: { alt: "Segitiga", asset, height: 1, width: 1 }, type: "image" },
  ],
  type: "doc",
});

describe("pictureIdsOfDocuments", () => {
  it("names the images of every document of a question once each, in reading order", () => {
    expect(
      pictureIdsOfDocuments([
        withPicture("first"),
        withPicture("second"),
        withPicture("first"),
      ])
    ).toEqual(["first", "second"]);
  });

  it("names no image for documents without one", () => {
    expect(
      pictureIdsOfDocuments([{ content: [{ type: "paragraph" }], type: "doc" }])
    ).toEqual([]);
  });
});

describe("addressesOf", () => {
  it("names each address by its image", () => {
    const address = Schema.decodeUnknownSync(AssetAddress)({
      id: "first",
      url: "https://nakafa.test/a",
    });

    expect(addressesOf([address])).toEqual({ first: "https://nakafa.test/a" });
  });
});

describe("partLabels", () => {
  it("reads the labels of options, of a match's two sides and of a table's rows and columns", () => {
    expect(partLabels(newChoiceAnswers())).toHaveLength(4);
    expect(partLabels(matchAnswers())).toHaveLength(6);
    expect(partLabels(tableAnswers(["Benar", "Salah"]))).toHaveLength(5);
  });

  it("reads nothing from an answer without labels", () => {
    expect(Arr.isReadonlyArrayEmpty(partLabels(shortAnswers()))).toBe(true);
  });
});
