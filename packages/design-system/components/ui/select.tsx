import { ArrowDown01Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import {
  HugeIcons,
  OptionIcon,
  type OptionMark,
} from "@repo/design-system/components/ui/huge-icons";
import { SheetGrip } from "@repo/design-system/components/ui/sheet-grip";
import { ButtonGroupVariant } from "@repo/design-system/lib/group";
import {
  optionRowVariants,
  optionTickVariants,
} from "@repo/design-system/lib/option";
import { popupMotion, sheetSurface } from "@repo/design-system/lib/popup";
import {
  SelectContent as SelectContentPrimitive,
  SelectGroup,
  SelectGroupLabel,
  SelectItemIcon,
  SelectItemIndicator,
  SelectItem as SelectItemPrimitive,
  Select as SelectPrimitive,
  SelectTrigger as SelectTriggerPrimitive,
  SelectValue as SelectValuePrimitive,
} from "@ui-sdk/react/select";
import { cva } from "class-variance-authority";
import { cn } from "cn";
import { Array as Arr } from "effect";
import type * as React from "react";
import { useTranslations } from "use-intl";

/**
 * A select. On a phone its list rises from the bottom as a sheet, and on a wide or a mouse screen it opens over its
 * trigger with the chosen item on it. One with nothing to choose from stays shut, since it would open on an empty
 * line: its caller says what must happen first.
 */
function Select<Value = string, Multiple extends boolean | undefined = false>(
  props: React.ComponentProps<typeof SelectPrimitive<Value, Multiple>>
) {
  return (
    <SelectPrimitive<Value, Multiple>
      presentation="auto"
      {...props}
      disabled={props.disabled === true || props.items?.length === 0}
    />
  );
}

/**
 * The chosen item in the trigger, on one line: a label longer than the trigger ends in an ellipsis, so it never
 * pushes the text or the chevron past the trigger's border.
 */
const selectValueVariants = cva("min-w-0 flex-1 truncate text-start");

function SelectValue({
  className,
  labels,
  placeholder,
  ...rest
}: Omit<
  React.ComponentProps<typeof SelectValuePrimitive>,
  "className" | "placeholder"
> & {
  className?: string | undefined;
  /** What shows while nothing is chosen, in place of the select's own `placeholder`. */
  placeholder?: string | undefined;
  /**
   * Every label the select can show, given where its value changes on its own, as a playing lab's time does: the
   * value keeps the widest label's width, so the trigger never grows and nothing beside it moves. Each label is
   * drawn as generated content of an empty, hidden cell, so the trigger's text and name stay its value alone.
   */
  labels?: readonly string[];
}) {
  const props = placeholder === undefined ? rest : { ...rest, placeholder };

  if (labels === undefined) {
    return (
      <SelectValuePrimitive
        className={selectValueVariants({ className })}
        {...props}
      />
    );
  }

  return (
    <span className="grid min-w-0 flex-1" data-slot="select-value-frame">
      {Arr.map(labels, (label) => (
        <span
          aria-hidden="true"
          className={selectValueVariants({
            className:
              "invisible col-start-1 row-start-1 before:content-[attr(data-label)]",
          })}
          data-label={label}
          key={label}
        />
      ))}
      <SelectValuePrimitive
        className={selectValueVariants({
          className: cn("col-start-1 row-start-1", className),
        })}
        {...props}
      />
    </span>
  );
}

/** The look of a select's button, which a picker with a search box of its own wears too. */
const selectTriggerVariants = cva(
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground dark:aria-invalid:ring-destructive/40 flex max-w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] ease-out outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    defaultVariants: { width: "fit" },
    variants: { width: { fit: "w-fit", full: "w-full" } },
  }
);

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: Omit<
  React.ComponentProps<typeof SelectTriggerPrimitive>,
  "children" | "className"
> & {
  children?: React.ReactNode;
  className?: string | undefined;
  size?: "sm" | "default";
}) {
  return (
    <SelectTriggerPrimitive
      className={cn(selectTriggerVariants(), className)}
      data-size={size}
      {...props}
    >
      {children}
      <HugeIcons
        aria-hidden="true"
        className="text-inherit opacity-80"
        icon={ArrowDown01Icon}
      />
    </SelectTriggerPrimitive>
  );
}

/**
 * The list of a select. It opens with its one-word label, which names what is chosen, so a list never reads as bare
 * codes: the label is required, and the list draws it above its items. On a mouse screen the chosen item opens over
 * the trigger, as a native select does; a list that stands under its trigger passes `alignItemWithTrigger={false}`.
 */
function SelectContent({
  alignItemWithTrigger = true,
  className,
  children,
  label,
  ...props
}: Omit<
  React.ComponentProps<typeof SelectContentPrimitive>,
  "children" | "className"
> & {
  children?: React.ReactNode;
  className?: string | undefined;
  /** The one word that names what is chosen, such as "Kelas". */
  label: string;
}) {
  return (
    <ButtonGroupVariant value={undefined}>
      <SelectContentPrimitive
        alignItemWithTrigger={alignItemWithTrigger}
        className={cn(
          popupMotion(),
          sheetSurface(),
          "bg-popover text-popover-foreground z-50 max-h-(--available-height) w-max max-w-(--available-width) min-w-(--anchor-width) scroll-py-1 overflow-x-hidden overflow-y-auto overscroll-contain rounded-md border p-1 shadow-md inset-shadow-[0_-1px_--theme(--color-black/4%)] outline-none not-dark:bg-clip-padding data-[presentation=sheet]:px-2 dark:inset-shadow-[0_1px_--theme(--color-white/6%)] [&:not(:has([data-slot=select-item]))]:[--select-nothing:block]",
          className
        )}
        {...props}
      >
        <SheetGrip />
        <SelectGroup>
          <SelectGroupLabel className="text-muted-foreground px-2 py-1.5 text-xs">
            {label}
          </SelectGroupLabel>
          {children}
        </SelectGroup>
        <SelectNothing />
      </SelectContentPrimitive>
    </ButtonGroupVariant>
  );
}

/** The sentence of a list with no item, so a select never opens on a thin empty line, however its caller fills it. */
function SelectNothing() {
  const t = useTranslations("Common");

  return (
    <p className="text-muted-foreground [display:var(--select-nothing,none)] px-2 py-6 text-center text-sm">
      {t("popup-empty")}
    </p>
  );
}

/** One choice of a select. It shows the icon of its kind before its words, so it never reads as a bare code. */
function SelectItem<Value = string>({
  className,
  children,
  icon,
  plain,
  ...props
}: Omit<
  React.ComponentProps<typeof SelectItemPrimitive<Value>>,
  "className" | "children"
> &
  OptionMark & {
    children?: React.ReactNode;
    className?: string | undefined;
  }) {
  return (
    <SelectItemPrimitive<Value>
      className={cn(optionRowVariants({ mark: "tick" }), className)}
      {...props}
    >
      {plain ? null : (
        <SelectItemIcon>
          <OptionIcon icon={icon} />
        </SelectItemIcon>
      )}
      <span className="flex min-w-0 flex-1 items-center gap-2 text-pretty">
        {children}
      </span>
      <SelectItemIndicator className={optionTickVariants()}>
        <HugeIcons icon={Tick01Icon} />
      </SelectItemIndicator>
    </SelectItemPrimitive>
  );
}

export {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  selectTriggerVariants,
};
