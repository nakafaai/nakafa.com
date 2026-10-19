import { MAX_ASSET_READS } from "@repo/backend/confect/exams/asset";
import { Node } from "@tiptap/pm/model";
import { Array as Arr } from "effect";
import { createContext } from "react";
import { assessmentSchema } from "@/lib/editor/assessment";
import {
  assetIdsOf,
  type ExamAssetIdValue,
} from "@/lib/editor/pictures";

/**
 * The addresses of the images that a question draws, by image ID. The question resolves them in
 * one read and provides them here, so every document of the question draws its images without a
 * prop on the way down.
 */
export const SittingPictures = createContext<Readonly<Record<string, string>>>(
  {}
);

/**
 * The IDs of the images that the documents of one question hold, at most `MAX_ASSET_READS` of
 * them, so one read resolves them all. Each document is the JSON object that the paper holds.
 */
export function pictureIdsOfDocuments(
  documents: readonly unknown[]
): readonly ExamAssetIdValue[] {
  return Arr.dedupe(
    Arr.take(
      Arr.flatMap(documents, (document) =>
        assetIdsOf(Node.fromJSON(assessmentSchema, document))
      ),
      MAX_ASSET_READS
    )
  );
}
