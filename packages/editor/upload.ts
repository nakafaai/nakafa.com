import { Schema } from "effect";

/**
 * What one image of an exam may be. The editor, the upload and the server all read
 * these two facts, so they live apart from the editor's Tiptap extension: a module
 * that only needs the rule never loads the editor.
 */

/** The most bytes one image of an exam may hold: 2 MB. The editor refuses a larger file, and the server checks it again. */
export const IMAGE_BYTE_LIMIT = 2 * 1024 * 1024;

/** The kinds of image an exam holds, which a file's leading bytes name and the editor accepts. */
export const ImageType = Schema.Literals([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
