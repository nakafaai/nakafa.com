import {
  CheckmarkSquare02Icon,
  DecimalsArrowRightIcon,
  FlowConnectionIcon,
  InputTextIcon,
  LinkSquare02Icon,
  NoteEditIcon,
  QuestionIcon,
  RadioButtonIcon,
  Table02Icon,
  ThumbsUpDownIcon,
} from "@hugeicons/core-free-icons";
import type { QuestionTemplate } from "@repo/backend/confect/exams/question";

/**
 * The icon each template shows by: a radio for one answer, a check box for several, a thumb up and
 * down for true or false, a flow from a statement to its reason for cause and effect, a text
 * field for a short answer, a decimal point for a numeric answer, a note for an essay, a link for matching, and a table for a true or false
 * table.
 */
export const TEMPLATE_ICON = {
  cause: FlowConnectionIcon,
  choice: RadioButtonIcon,
  choices: CheckmarkSquare02Icon,
  essay: NoteEditIcon,
  match: LinkSquare02Icon,
  numeric: DecimalsArrowRightIcon,
  reason: QuestionIcon,
  short: InputTextIcon,
  table: Table02Icon,
  truefalse: ThumbsUpDownIcon,
} satisfies Record<QuestionTemplate, typeof RadioButtonIcon>;

/** The name of each template, as the picker and the row show it. */
export const TEMPLATE_NAME = {
  cause: "template-cause",
  choice: "template-choice",
  choices: "template-choices",
  essay: "template-essay",
  match: "template-match",
  numeric: "template-numeric",
  reason: "template-reason",
  short: "template-short",
  table: "template-table",
  truefalse: "template-truefalse",
} as const satisfies Record<QuestionTemplate, string>;
