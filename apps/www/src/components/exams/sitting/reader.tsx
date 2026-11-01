import { editorDocument } from "@repo/design-system/components/editor/frame";
import { Node } from "@tiptap/pm/model";
import { cn } from "cn";
import { useMemo } from "react";
import { DrawnDocument } from "@/components/assessment/drawn";
import { assessmentSchema } from "@/lib/editor/assessment";

/**
 * One assessment document, read-only, as the exam canvas and the published article read it. It is drawn once
 * without an editor (`drawDocument`), so a paper of forty questions with their options costs a slow phone a
 * walk over each document, not an editor for each. The document is the JSON object of a prompt or of an option
 * label: a prompt reads as a page, with the article's paragraphs, and an option as one line.
 */
export function SittingReader({
  document,
  size = "page",
}: {
  readonly document: unknown;
  /** How the text reads: a prompt as a page, and an option as one line. */
  readonly size?: "line" | "page";
}) {
  const content = useMemo(
    () => Node.fromJSON(assessmentSchema, document),
    [document]
  );

  return (
    <DrawnDocument
      className={cn(editorDocument({ size, text: "article" }), "min-h-0")}
      doc={content}
      paragraphs={size === "page"}
    />
  );
}
