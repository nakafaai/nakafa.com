import { Button } from "@repo/design-system/components/ui/button";
import { cva } from "class-variance-authority";
import type { ComponentProps } from "react";

/**
 * The pressed option keeps a transparent border as wide as the others'
 * outline, so every option keeps its size whichever one is pressed.
 */
const choiceVariants = cva("", {
  variants: {
    pressed: {
      false: "",
      true: "border border-transparent",
    },
  },
});

/**
 * One option of a set, filled when pressed and outlined otherwise. An option
 * that changes on its own, such as the generation a growth reaches, moves
 * none of the others.
 */
export function Choice({
  pressed,
  ...props
}: Omit<ComponentProps<typeof Button>, "size" | "variant"> & {
  pressed: boolean;
}) {
  return (
    <Button
      aria-pressed={pressed}
      className={choiceVariants({ pressed })}
      size="sm"
      variant={pressed ? "default" : "outline"}
      {...props}
    />
  );
}
