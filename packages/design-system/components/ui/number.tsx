import { NumberField as NumberFieldPrimitive } from "@base-ui/react/number-field";
import { MinusSignIcon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cva } from "class-variance-authority";
import { cn } from "cn";
import { useLocale, useTranslations } from "use-intl";

/**
 * A field that holds one number, as Base UI builds it: a text input that reads and writes the
 * number in the page's locale, with a decrease and an increase button, and the arrow keys
 * stepping it within `min` and `max`. The browser draws no spin buttons, because the input is a
 * text field that asks for the numeric keyboard.
 */
function NumberField({ className, ...props }: NumberFieldPrimitive.Root.Props) {
  const locale = useLocale();

  return (
    <NumberFieldPrimitive.Root
      className={cn("w-full", className)}
      data-slot="number-field"
      locale={locale}
      {...props}
    />
  );
}

/** The bordered row of a number field: its decrease button, its input and its increase button. */
function NumberFieldGroup({
  className,
  ...props
}: NumberFieldPrimitive.Group.Props) {
  return (
    <NumberFieldPrimitive.Group
      className={cn(
        "border-input has-aria-invalid:border-destructive has-focus-visible:border-ring has-aria-invalid:ring-destructive/20 has-focus-visible:ring-ring/50 flex h-9 w-full min-w-0 items-stretch overflow-hidden rounded-md border shadow-xs transition-[color,box-shadow] outline-none has-focus-visible:ring-3 data-disabled:opacity-50",
        className
      )}
      data-slot="number-field-group"
      {...props}
    />
  );
}

/** The text input of a number field, with its digits centred, named as a number field in the page's locale. */
function NumberFieldInput({
  className,
  ...props
}: NumberFieldPrimitive.Input.Props) {
  const t = useTranslations("Common");

  return (
    <NumberFieldPrimitive.Input
      aria-roledescription={t("number-field")}
      className={cn(
        "selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground w-full min-w-0 flex-1 bg-transparent px-2 text-center text-base tabular-nums outline-none disabled:cursor-not-allowed md:text-sm",
        className
      )}
      data-slot="number-field-input"
      {...props}
    />
  );
}

/** A stepper button of a number field, divided from the input on the side that faces it. */
const numberFieldStepVariants = cva(
  "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground flex w-9 shrink-0 items-center justify-center transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      side: {
        end: "border-l",
        start: "border-r",
      },
    },
  }
);

/** The button of a number field that steps its number down, named in the page's locale. */
function NumberFieldDecrement({
  className,
  ...props
}: NumberFieldPrimitive.Decrement.Props) {
  const t = useTranslations("Common");

  return (
    <NumberFieldPrimitive.Decrement
      aria-label={t("decrease")}
      className={cn(numberFieldStepVariants({ side: "start" }), className)}
      data-slot="number-field-decrement"
      {...props}
    >
      <HugeIcons className="size-4" icon={MinusSignIcon} />
    </NumberFieldPrimitive.Decrement>
  );
}

/** The button of a number field that steps its number up, named in the page's locale. */
function NumberFieldIncrement({
  className,
  ...props
}: NumberFieldPrimitive.Increment.Props) {
  const t = useTranslations("Common");

  return (
    <NumberFieldPrimitive.Increment
      aria-label={t("increase")}
      className={cn(numberFieldStepVariants({ side: "end" }), className)}
      data-slot="number-field-increment"
      {...props}
    >
      <HugeIcons className="size-4" icon={PlusSignIcon} />
    </NumberFieldPrimitive.Increment>
  );
}

export {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
};
