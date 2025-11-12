"use client";

import { cn } from "@repo/design-system/lib/tiptap-utils";
import "@repo/design-system/components/tiptap-ui-primitive/input/input.scss";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input className={cn("tiptap-input", className)} type={type} {...props} />
  );
}

function InputGroup({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("tiptap-input-group", className)} {...props}>
      {children}
    </div>
  );
}

export { Input, InputGroup };
