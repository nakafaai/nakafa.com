import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { Separator } from "@repo/design-system/components/ui/separator";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

/**
 * One joined frame: the first part rounds its start, the last rounds its end, and the parts between stand square on one
 * shared border. Every child that shows is a part, whatever it is, and a form's hidden input is not. A child with no
 * `data-slot` is a wrapper, so it passes its shape to the controls inside it, and its controls join the row.
 *
 * CSS cannot see `display: none`, so a child that hides at some width would still shape its neighbours. A control that
 * changes form with the width is therefore one wrapper around both forms (`TableSearch`), never two children. Controls
 * that stand apart do not go in a group: they keep a clear gap.
 */
const buttonGroupVariants = cva(
  "flex w-fit items-stretch *:focus-visible:relative *:focus-visible:z-10 has-[>[data-slot=button-group]]:gap-2 [&>:not([data-slot],[aria-hidden])]:rounded-md [&>:not([data-slot],[aria-hidden])>[data-slot]]:rounded-[inherit] [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1",
  {
    variants: {
      orientation: {
        horizontal:
          "[&>:not([aria-hidden]):has(~:not([aria-hidden]))]:rounded-r-none [&>:not([aria-hidden])~:not([aria-hidden])]:rounded-l-none [&>:not([aria-hidden])~:not([aria-hidden])]:border-l-0 [&>:not([aria-hidden])~:not([data-slot],[aria-hidden])>[data-slot]]:border-l-0",
        vertical:
          "flex-col [&>:not([aria-hidden]):has(~:not([aria-hidden]))]:rounded-b-none [&>:not([aria-hidden])~:not([aria-hidden])]:rounded-t-none [&>:not([aria-hidden])~:not([aria-hidden])]:border-t-0 [&>:not([aria-hidden])~:not([data-slot],[aria-hidden])>[data-slot]]:border-t-0",
      },
    },
    defaultVariants: {
      orientation: "horizontal",
    },
  }
);

function ButtonGroup({
  className,
  orientation,
  ...props
}: React.ComponentProps<"fieldset"> &
  VariantProps<typeof buttonGroupVariants>) {
  return (
    <fieldset
      className={cn(buttonGroupVariants({ orientation }), className)}
      data-orientation={orientation}
      data-slot="button-group"
      {...props}
    />
  );
}

function ButtonGroupText({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          "bg-muted flex items-center gap-2 rounded-lg border px-2.5 text-sm [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
          className
        ),
      },
      props
    ),
    render,
    state: {
      slot: "button-group-text",
    },
  });
}

function ButtonGroupSeparator({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      className={cn(
        "bg-input relative m-0! self-stretch data-[orientation=vertical]:h-auto",
        className
      )}
      data-slot="button-group-separator"
      orientation={orientation}
      {...props}
    />
  );
}

export {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
  buttonGroupVariants,
};
