import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { Separator } from "@repo/design-system/components/ui/separator";
import { ButtonGroupVariant } from "@repo/design-system/lib/group";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

/**
 * One joined frame: the first part rounds its start, the last rounds its end, and the parts between stand square on one
 * shared border. A part is a control or a `div` that wraps one, and nothing else: an open menu's portal writes focus
 * guards and an owner span beside its trigger, and a select writes a hidden input, so a `span` or an `input` never
 * shapes a part, and no control changes shape on any state. A `div` passes its shape to the controls inside it, and
 * they join the row.
 *
 * CSS cannot see `display: none`, so a child that hides at some width would still shape its neighbours. A control that
 * changes form with the width is therefore one wrapper around both forms (`TableSearch`), never two children. A last
 * part that leaves from the `xl` width says so with `data-hides="xl"`, and the part before it then rounds its end.
 * Controls that stand apart do not go in a group: they keep a clear gap.
 */
const buttonGroupVariants = cva(
  "flex w-fit items-stretch *:focus-visible:relative *:focus-visible:z-10 has-[>[data-slot=button-group]]:gap-2 [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>div:not([data-slot])]:rounded-md [&>div:not([data-slot])>[data-slot]]:rounded-[inherit] [&>input]:flex-1",
  {
    variants: {
      orientation: {
        horizontal: "",
        vertical: "flex-col",
      },
      /**
       * Whether the parts share one frame. Ghost parts draw no border to share, so they keep their own radius and
       * stand side by side with no gap, as a toolbar's icons do.
       */
      joined: {
        false: "",
        true: "",
      },
    },
    compoundVariants: [
      {
        className:
          "xl:[&>:has(+[data-hides=xl]:last-child)]:rounded-r-md [&>:is([data-slot],a,button,div):has(~:is([data-slot],a,button,div))]:rounded-r-none [&>:is([data-slot],a,button,div)~:is([data-slot],a,button,div)]:rounded-l-none [&>:is([data-slot],a,button,div)~:is([data-slot],a,button,div)]:border-l-0 [&>:is([data-slot],a,button,div)~div:not([data-slot])>[data-slot]]:border-l-0",
        joined: true,
        orientation: "horizontal",
      },
      {
        className:
          "[&>:is([data-slot],a,button,div):has(~:is([data-slot],a,button,div))]:rounded-b-none [&>:is([data-slot],a,button,div)~:is([data-slot],a,button,div)]:rounded-t-none [&>:is([data-slot],a,button,div)~:is([data-slot],a,button,div)]:border-t-0 [&>:is([data-slot],a,button,div)~div:not([data-slot])>[data-slot]]:border-t-0",
        joined: true,
        orientation: "vertical",
      },
    ],
    defaultVariants: {
      joined: true,
      orientation: "horizontal",
    },
  }
);

/**
 * Joins controls of one kind. The group names the one variant its buttons wear, outline unless it says otherwise,
 * and every `Button` inside takes it, one drawn by another component included: the page's primary stands alone,
 * and a pressed part says so with `aria-pressed`, never with a variant of its own. A row of ghost icon buttons, such
 * as a sheet header's, is a ghost group: its parts touch, with no gap between them.
 */
function ButtonGroup({
  className,
  orientation,
  variant = "outline",
  ...props
}: React.ComponentProps<"fieldset"> &
  VariantProps<typeof buttonGroupVariants> & {
    variant?: NonNullable<React.ContextType<typeof ButtonGroupVariant>>;
  }) {
  return (
    <ButtonGroupVariant value={variant}>
      <fieldset
        className={cn(
          buttonGroupVariants({ joined: variant !== "ghost", orientation }),
          className
        )}
        data-orientation={orientation}
        data-slot="button-group"
        {...props}
      />
    </ButtonGroupVariant>
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
