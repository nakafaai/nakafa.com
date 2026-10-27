import { fieldBoxVariants } from "@repo/design-system/lib/input";
import { cn } from "cn";
import type * as React from "react";

/**
 * A single-line text field: words, an email address, a password, a phone number or an address.
 * A date, a time, a number and a search have fields of their own (DatePicker, TimeSelect,
 * NumberField and SearchField), so the browser never draws its own picker, spin buttons or clear
 * button. Every field shows what to write in its placeholder.
 */
function Input({
  className,
  type = "text",
  ...props
}: Omit<React.ComponentProps<"input">, "placeholder" | "type"> & {
  /** What the field shows while empty: an example value or a short hint of what to write. */
  placeholder: string;
  type?: "email" | "password" | "tel" | "text" | "url";
}) {
  return (
    <input
      className={cn(
        fieldBoxVariants(),
        "selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-sm placeholder:text-muted-foreground",
        className
      )}
      data-slot="input"
      type={type}
      {...props}
    />
  );
}

export { Input };
