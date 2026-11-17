import type { OptionIcon } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr, Option } from "effect";
import type { ComponentProps } from "react";
import type { BreadcrumbHeaderItem } from "@/components/shared/breadcrumb/header";
import type { LinkTarget } from "@/lib/routing/link";

/**
 * Builds the siblings of one crumb: the pages that stand at its place in the path, the crumb's own page among them
 * (`current`), each with the icon of its kind, as every menu option carries one. `label` is the one-word heading
 * that every menu names itself with, read from a `menu-` key. `onChoose` runs when an option is pressed, before its
 * link navigates, such as to remember the learner's country. The shape holds icons and a function, which no Schema
 * describes as data, so it is the parameter of this builder.
 */
export function crumbSiblings(siblings: {
  readonly label: string;
  readonly onChoose?:
    | ((option: {
        readonly label: string;
        readonly target: LinkTarget;
      }) => void)
    | undefined;
  readonly options: readonly {
    readonly current: boolean;
    readonly icon: NonNullable<ComponentProps<typeof OptionIcon>["icon"]>;
    readonly label: string;
    readonly target: LinkTarget;
  }[];
}) {
  return siblings;
}

export type CrumbSiblings = ReturnType<typeof crumbSiblings>;

/**
 * One crumb of a path, named after its own page: with two or more siblings it opens them, else it links to its own
 * page. A crumb whose own page is not among its options names nothing, so it is left out.
 */
export function siblingCrumb(
  siblings: CrumbSiblings
): Option.Option<BreadcrumbHeaderItem> {
  return Option.map(
    Arr.findFirst(siblings.options, (option) => option.current),
    (own) =>
      siblings.options.length > 1
        ? { label: own.label, siblings }
        : { label: own.label, target: own.target }
  );
}
