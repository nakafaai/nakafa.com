import { MinusSignIcon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  NumberInputControl,
  NumberInputDecrement,
  NumberInputGroup,
  NumberInputIncrement,
  NumberInput as NumberInputPrimitive,
} from "@ui-sdk/react/number-input";
import { cva } from "class-variance-authority";
import { cn } from "cn";
import type * as React from "react";
import { createContext, use } from "react";
import { useLocale, useTranslations } from "use-intl";

/** The id a number field gives its input, so a label's `htmlFor` names the input, as it names any other field. */
const NumberFieldId = createContext<string | undefined>(undefined);

/**
 * A field that holds one number: a text input that reads and writes the
 * number in the page's locale, with a decrease and an increase button, and the arrow keys
 * stepping it within `min` and `max`. The browser draws no spin buttons, because the input is a
 * text field that asks for the numeric keyboard. Its `id` is its input's, so a `FieldLabel` names
 * the input by it.
 */
function NumberField({
  className,
  id,
  ...props
}: React.ComponentProps<typeof NumberInputPrimitive>) {
  const locale = useLocale();

  return (
    <NumberFieldId value={id}>
      <NumberInputPrimitive
        className={cn("w-full", className)}
        locale={locale}
        {...props}
      />
    </NumberFieldId>
  );
}

/** The bordered row of a number field: its decrease button, its input and its increase button. */
function NumberFieldGroup({
  className,
  ...props
}: React.ComponentProps<typeof NumberInputGroup>) {
  return (
    <NumberInputGroup
      className={cn(
        "border-input has-aria-invalid:border-destructive has-focus-visible:border-ring has-aria-invalid:ring-destructive/20 has-focus-visible:ring-ring/50 flex h-9 w-full min-w-0 items-stretch overflow-hidden rounded-md border shadow-xs transition-[color,box-shadow] outline-none has-focus-visible:ring-3 data-disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

/** The text input of a number field, with its digits centred, named as a number field in the page's locale. */
function NumberFieldInput({
  className,
  id,
  ...props
}: React.ComponentProps<typeof NumberInputControl>) {
  const t = useTranslations("Common");
  const fieldId = use(NumberFieldId);

  return (
    <NumberInputControl
      aria-roledescription={t("number-field")}
      id={id ?? fieldId}
      className={cn(
        "selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground w-full min-w-0 flex-1 bg-transparent px-2 text-center text-base tabular-nums outline-none disabled:cursor-not-allowed md:text-sm",
        className
      )}
      {...props}
    />
  );
}

/** A stepper button of a number field, divided from the input on the side that faces it. */
const numberFieldStepVariants = cva(
  "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground flex w-9 shrink-0 items-center justify-center transition-colors data-disabled:pointer-events-none data-disabled:opacity-50",
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
}: React.ComponentProps<typeof NumberInputDecrement>) {
  const t = useTranslations("Common");

  return (
    <NumberInputDecrement
      aria-label={t("decrease")}
      className={cn(numberFieldStepVariants({ side: "start" }), className)}
      {...props}
    >
      <HugeIcons icon={MinusSignIcon} />
    </NumberInputDecrement>
  );
}

/** The button of a number field that steps its number up, named in the page's locale. */
function NumberFieldIncrement({
  className,
  ...props
}: React.ComponentProps<typeof NumberInputIncrement>) {
  const t = useTranslations("Common");

  return (
    <NumberInputIncrement
      aria-label={t("increase")}
      className={cn(numberFieldStepVariants({ side: "end" }), className)}
      {...props}
    >
      <HugeIcons icon={PlusSignIcon} />
    </NumberInputIncrement>
  );
}

export {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
};
