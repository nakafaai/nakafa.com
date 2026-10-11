"use client";

import {
  ArrowDown01Icon,
  Heading01Icon,
  Heading02Icon,
  Heading03Icon,
  TextIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useCurrentEditor, useEditorState } from "@tiptap/react";
import { Array as Arr, Option } from "effect";

/** The style of a paragraph that is no heading. */
const TEXT = "text";

/**
 * The control that sets the style of the paragraph the caret sits in: normal
 * text, or one of three headings. It shows the style in use and opens a menu
 * with all four.
 */
export function RichEditorStyle({
  labels,
}: {
  labels: {
    heading1: string;
    heading2: string;
    heading3: string;
    style: string;
    text: string;
  };
}) {
  const { editor } = useCurrentEditor();
  const styles = [
    {
      icon: TextIcon,
      label: labels.text,
      name: TEXT,
      run: () => editor?.chain().focus().setParagraph().run(),
    },
    {
      icon: Heading01Icon,
      label: labels.heading1,
      name: "heading-1",
      run: () => editor?.chain().focus().setHeading({ level: 1 }).run(),
    },
    {
      icon: Heading02Icon,
      label: labels.heading2,
      name: "heading-2",
      run: () => editor?.chain().focus().setHeading({ level: 2 }).run(),
    },
    {
      icon: Heading03Icon,
      label: labels.heading3,
      name: "heading-3",
      run: () => editor?.chain().focus().setHeading({ level: 3 }).run(),
    },
  ];
  const level = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      Option.getOrElse(
        Arr.findFirst(
          [1, 2, 3],
          (heading) => current?.isActive("heading", { level: heading }) === true
        ),
        () => 0
      ),
  });
  const used = level ? `heading-${level}` : TEXT;
  const icon = Option.getOrElse(
    Option.map(
      Arr.findFirst(styles, ({ name }) => name === used),
      (style) => style.icon
    ),
    () => TextIcon
  );

  /** Gives the paragraph the style the writer picked. */
  function apply(picked: string) {
    const style = Arr.findFirst(styles, ({ name }) => name === picked);

    if (Option.isSome(style)) {
      style.value.run();
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={labels.style}
            className="gap-0.5 has-[>svg]:px-1.5"
            size="sm"
            title={labels.style}
            type="button"
            variant="ghost"
          />
        }
      >
        <HugeIcons icon={icon} />
        <HugeIcons
          className="size-3 text-muted-foreground"
          icon={ArrowDown01Icon}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-44"
        // After a pick with the pointer the caret goes back to the text.
        finalFocus={(closed) =>
          closed === "keyboard" ? true : (editor?.view.dom ?? true)
        }
      >
        <DropdownMenuRadioGroup onValueChange={apply} value={used}>
          {Arr.map(styles, (style) => (
            <DropdownMenuRadioItem key={style.name} value={style.name}>
              <HugeIcons icon={style.icon} />
              {style.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
