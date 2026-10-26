import {
  CheckmarkSquare02Icon,
  FlowConnectionIcon,
  InputTextIcon,
  LinkSquare02Icon,
  NoteEditIcon,
  RadioButtonIcon,
  Table02Icon,
  ThumbsUpDownIcon,
  UnfoldMoreIcon,
} from "@hugeicons/core-free-icons";
import { QuestionTemplate } from "@repo/backend/confect/exams/question";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr, Schema } from "effect";
import { useTranslations } from "use-intl";

/**
 * The icon each template shows by: a radio for one answer, a check box for several, a thumb up and
 * down for true or false, a flow from a statement to its reason for cause and effect, a text
 * field for a short answer, a note for an essay, a link for matching, and a table for a true or false
 * table.
 */
const TEMPLATE_ICON = {
  cause: FlowConnectionIcon,
  choice: RadioButtonIcon,
  choices: CheckmarkSquare02Icon,
  essay: NoteEditIcon,
  match: LinkSquare02Icon,
  short: InputTextIcon,
  table: Table02Icon,
  truefalse: ThumbsUpDownIcon,
} satisfies Record<QuestionTemplate, typeof RadioButtonIcon>;

/** The name of each template, as the picker and the row show it. */
const TEMPLATE_NAME = {
  cause: "template-cause",
  choice: "template-choice",
  choices: "template-choices",
  essay: "template-essay",
  match: "template-match",
  short: "template-short",
  table: "template-table",
  truefalse: "template-truefalse",
} as const satisfies Record<QuestionTemplate, string>;

/**
 * The type of one question, in the row above its page, as Google Forms names a question's type on its
 * card: its icon and its name, and a menu of the types the question can take. Choosing another type
 * converts the question at once. A question that cannot change now, because the exam is locked, the
 * server has not saved it, or Convex does not hold the session yet, shows its type without the menu.
 */
export function QuestionType({
  editable,
  onChange,
  template,
}: {
  editable: boolean;
  onChange: (template: QuestionTemplate) => void;
  template: QuestionTemplate;
}) {
  const t = useTranslations("Exams");
  const name = t(TEMPLATE_NAME[template]);

  if (!editable) {
    return (
      <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
        <HugeIcons aria-hidden="true" icon={TEMPLATE_ICON[template]} />
        <span>{name}</span>
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={t("template-label", { type: name })}
            className="text-muted-foreground"
            size="sm"
            variant="ghost"
          />
        }
      >
        <HugeIcons aria-hidden="true" icon={TEMPLATE_ICON[template]} />
        <span>{name}</span>
        <HugeIcons aria-hidden="true" icon={UnfoldMoreIcon} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuRadioGroup
            onValueChange={(value) => {
              if (Schema.is(QuestionTemplate)(value)) {
                onChange(value);
              }
            }}
            value={template}
          >
            {Arr.map(QuestionTemplate.literals, (item) => (
              <DropdownMenuRadioItem
                className="cursor-pointer"
                key={item}
                value={item}
              >
                <HugeIcons icon={TEMPLATE_ICON[item]} />
                {t(TEMPLATE_NAME[item])}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
