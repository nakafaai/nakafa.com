import { describe, expect, it } from "@effect/vitest";
import { pictureIdsOfDocuments } from "@/components/exams/sitting/pictures";

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
      pictureIdsOfDocuments([withPicture("first"), withPicture("second"), withPicture("first")])
    ).toEqual(["first", "second"]);
  });

  it("names no image for documents without one", () => {
    expect(
      pictureIdsOfDocuments([{ content: [{ type: "paragraph" }], type: "doc" }])
    ).toEqual([]);
  });
});
