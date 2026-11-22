import { Separator } from "@repo/design-system/components/ui/separator";
import { ButtonGroupVariant } from "@repo/design-system/lib/group";
import type { RenderableProps } from "@repo/design-system/lib/render";
import { renderElement } from "@ui-sdk/react/primitive";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import { cn } from "cn";

/**
 * One joined frame: the first part rounds its start, the last rounds its end, and the parts between stand square on one
 * shared border. A part is a control or a `div` that wraps one, and nothing else: a popup renders beside its trigger
 * in a `span` that takes no room (`PopupPlace`), and a select writes a hidden input, so neither a popup, a `span` nor
 * an `input` shapes a part, and no control changes shape on any state, a tooltip that opens on hover included. A `div` passes its shape to the controls inside it, and they join the row.
 *
 * CSS cannot see `display: none`, so a child that hides at some width would still shape its neighbours. A control that
 * changes form with the width is therefore one wrapper around both forms (`TableSearch`), never two children. A part
 * that waits hidden by its `hidden` attribute, such as a place an inline script shows before the first paint, shapes
 * nothing until it shows. A first or last part that leaves from a width says which with `data-hides` (`sm`, `md`,
 * `lg`, `xl` or `2xl`), and from that width its neighbour takes the group's outer corner and edge, so the parts that
 * show always round the group's ends: a lone part is round on both. Controls that stand apart do not go in a group:
 * they keep a clear gap.
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
          "[&>:is([data-slot],a,button,div):not([hidden]):has(~:is([data-slot],a,button,div):not([hidden]))]:rounded-r-none [&>:is([data-slot],a,button,div):not([hidden])~:is([data-slot],a,button,div):not([hidden])]:rounded-l-none [&>:is([data-slot],a,button,div):not([hidden])~:is([data-slot],a,button,div):not([hidden])]:border-l-0 [&>:is([data-slot],a,button,div):not([hidden])~div:not([data-slot]):not([hidden])>[data-slot]]:border-l-0",
        joined: true,
        orientation: "horizontal",
      },
      {
        // A part that leaves from a width (`data-hides`) hands the group's outer corner, and at the start its edge, to
        // its neighbour from that width. These selectors weigh more than the joining ones above, so they win whatever
        // order the styles come in. Count controls rather than DOM siblings so a popup beside its trigger does
        // not interrupt the first or last pair of parts.
        className: [
          "sm:[&>:nth-last-child(2_of_:is([data-slot],a,button,div):not([hidden])):has(~[data-hides=sm]:nth-last-child(1_of_:is([data-slot],a,button,div):not([hidden])))]:rounded-r-md sm:[&>[data-hides=sm]:nth-child(1_of_:is([data-slot],a,button,div):not([hidden]))~:nth-child(2_of_:is([data-slot],a,button,div):not([hidden]))]:rounded-l-md sm:[&>[data-hides=sm]:nth-child(1_of_:is([data-slot],a,button,div):not([hidden]))~:nth-child(2_of_:is([data-slot],a,button,div):not([hidden]))]:border-l",
          "md:[&>:nth-last-child(2_of_:is([data-slot],a,button,div):not([hidden])):has(~[data-hides=md]:nth-last-child(1_of_:is([data-slot],a,button,div):not([hidden])))]:rounded-r-md md:[&>[data-hides=md]:nth-child(1_of_:is([data-slot],a,button,div):not([hidden]))~:nth-child(2_of_:is([data-slot],a,button,div):not([hidden]))]:rounded-l-md md:[&>[data-hides=md]:nth-child(1_of_:is([data-slot],a,button,div):not([hidden]))~:nth-child(2_of_:is([data-slot],a,button,div):not([hidden]))]:border-l",
          "lg:[&>:nth-last-child(2_of_:is([data-slot],a,button,div):not([hidden])):has(~[data-hides=lg]:nth-last-child(1_of_:is([data-slot],a,button,div):not([hidden])))]:rounded-r-md lg:[&>[data-hides=lg]:nth-child(1_of_:is([data-slot],a,button,div):not([hidden]))~:nth-child(2_of_:is([data-slot],a,button,div):not([hidden]))]:rounded-l-md lg:[&>[data-hides=lg]:nth-child(1_of_:is([data-slot],a,button,div):not([hidden]))~:nth-child(2_of_:is([data-slot],a,button,div):not([hidden]))]:border-l",
          "xl:[&>:nth-last-child(2_of_:is([data-slot],a,button,div):not([hidden])):has(~[data-hides=xl]:nth-last-child(1_of_:is([data-slot],a,button,div):not([hidden])))]:rounded-r-md xl:[&>[data-hides=xl]:nth-child(1_of_:is([data-slot],a,button,div):not([hidden]))~:nth-child(2_of_:is([data-slot],a,button,div):not([hidden]))]:rounded-l-md xl:[&>[data-hides=xl]:nth-child(1_of_:is([data-slot],a,button,div):not([hidden]))~:nth-child(2_of_:is([data-slot],a,button,div):not([hidden]))]:border-l",
          "2xl:[&>:nth-last-child(2_of_:is([data-slot],a,button,div):not([hidden])):has(~[data-hides='2xl']:nth-last-child(1_of_:is([data-slot],a,button,div):not([hidden])))]:rounded-r-md 2xl:[&>[data-hides='2xl']:nth-child(1_of_:is([data-slot],a,button,div):not([hidden]))~:nth-child(2_of_:is([data-slot],a,button,div):not([hidden]))]:rounded-l-md 2xl:[&>[data-hides='2xl']:nth-child(1_of_:is([data-slot],a,button,div):not([hidden]))~:nth-child(2_of_:is([data-slot],a,button,div):not([hidden]))]:border-l",
        ],
        joined: true,
        orientation: "horizontal",
      },
      {
        className:
          "[&>:is([data-slot],a,button,div):not([hidden]):has(~:is([data-slot],a,button,div):not([hidden]))]:rounded-b-none [&>:is([data-slot],a,button,div):not([hidden])~:is([data-slot],a,button,div):not([hidden])]:rounded-t-none [&>:is([data-slot],a,button,div):not([hidden])~:is([data-slot],a,button,div):not([hidden])]:border-t-0 [&>:is([data-slot],a,button,div):not([hidden])~div:not([data-slot]):not([hidden])>[data-slot]]:border-t-0",
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
}: RenderableProps<"div">) {
  return renderElement(
    "div",
    {
      "data-slot": "button-group-text",
      ...props,
      className: cn(
        "bg-muted flex items-center gap-2 rounded-lg border px-2.5 text-sm [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        className
      ),
    },
    render
  );
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
