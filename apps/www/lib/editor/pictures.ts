import { Id } from "@repo/backend/confect/_generated/id";
import { MAX_ASSET_READS } from "@repo/backend/confect/exams/asset";
import type { Node } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import { Array as Arr, MutableList, Option, Schema } from "effect";

/** The ID of an image of an exam, which a document holds as its asset. */
const ExamAssetId = Id("examAssets");

/** The ID of one image of an exam, as a document names it. */
export type ExamAssetIdValue = typeof ExamAssetId.Type;

/**
 * The IDs of the images that a document holds, in reading order, at most `MAX_ASSET_READS` of
 * them, so one read resolves a prompt's images. An image with an ID that is not an image ID is
 * left out, as the server would refuse it.
 */
export function assetIdsOf(doc: Node): readonly ExamAssetIdValue[] {
  const found = MutableList.make<ExamAssetIdValue>();
  doc.descendants((node) => {
    if (node.type.name === "image") {
      const id = Schema.decodeUnknownOption(ExamAssetId)(node.attrs.asset);
      if (Option.isSome(id)) {
        MutableList.append(found, id.value);
      }
    }
  });
  return Arr.dedupe(Arr.take(MutableList.toArray(found), MAX_ASSET_READS));
}

/**
 * A plugin that reports the images of the document when its view opens and each time the document
 * changes, whatever installs the change. A transaction reports its change to the editor's update
 * handler, but a state that the sync loop installs (the server's document, or a rebase of it) does
 * not, so the plugin reads every new document of the view. A view that opens on a saved document
 * reports that document's images too, so a reopened question resolves its pictures.
 */
export function pictureIdsPlugin(
  onChange: (ids: readonly ExamAssetIdValue[]) => void
) {
  return new Plugin({
    view: (view) => {
      onChange(assetIdsOf(view.state.doc));
      return {
        update: (updated, previous) => {
          if (updated.state.doc !== previous.doc) {
            onChange(assetIdsOf(updated.state.doc));
          }
        },
      };
    },
  });
}
