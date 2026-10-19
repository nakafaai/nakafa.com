import { describe, expect, it } from "@effect/vitest";
import { EditorState } from "@tiptap/pm/state";
import { EditorView } from "@tiptap/pm/view";
import { MutableList } from "effect";
import { assessmentSchema } from "@/lib/editor/assessment";
import {
  assetIdsOf,
  type ExamAssetIdValue,
  pictureIdsPlugin,
} from "@/lib/editor/pictures";

/** One image node of the assessment schema, which names an asset. */
const picture = (asset: unknown) =>
  assessmentSchema.nodes.image.create({
    alt: "Segitiga",
    asset,
    height: 1,
    width: 1,
  });

describe("assetIdsOf", () => {
  it("reads the images of a document in reading order, once each, and leaves out a name that is no ID", () => {
    const doc = assessmentSchema.node("doc", null, [
      picture("first"),
      assessmentSchema.nodes.paragraph.create(),
      picture("second"),
      picture("first"),
      picture(7),
    ]);
    expect(assetIdsOf(doc)).toEqual(["first", "second"]);
  });

  it("reads no image from a document without one", () => {
    const doc = assessmentSchema.node("doc", null, [
      assessmentSchema.nodes.paragraph.create(),
    ]);
    expect(assetIdsOf(doc)).toEqual([]);
  });
});

describe("pictureIdsPlugin", () => {
  it("reports the images of the view's document each time a change installs a new document", () => {
    const reported = MutableList.make<readonly ExamAssetIdValue[]>();
    const state = EditorState.create({
      doc: assessmentSchema.node("doc", null, [
        assessmentSchema.nodes.paragraph.create(),
      ]),
      plugins: [pictureIdsPlugin((ids) => MutableList.append(reported, ids))],
      schema: assessmentSchema,
    });
    const view = new EditorView(document.createElement("div"), { state });
    view.dispatch(view.state.tr.insert(0, picture("kept")));
    expect(MutableList.toArray(reported)).toEqual([["kept"]]);
    view.dispatch(view.state.tr.setMeta("note", "selection only"));
    expect(MutableList.toArray(reported)).toEqual([["kept"]]);
    view.destroy();
  });
});
