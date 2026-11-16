import { createContext } from "react";

/**
 * The part of the page a framed editor's Try as student opens, by its id, for
 * an editor that stands in a frame on a page outside any school, as the School
 * landing shows it. Outside a frame it is `null`, and the editor leaves to its
 * school's own pages. A framed editor has no school to go back to, to copy an
 * exam into or to delete one from, so it draws none of those ways out.
 */
export const ExamFrameContext = createContext<string | null>(null);
