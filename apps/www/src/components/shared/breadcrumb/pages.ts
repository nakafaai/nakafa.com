import type { OptionIcon } from "@repo/design-system/components/ui/huge-icons";
import type { ComponentProps } from "react";
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
    readonly icon: ComponentProps<typeof OptionIcon>["icon"];
    readonly label: string;
    readonly target: LinkTarget;
  }[];
}) {
  return siblings;
}

export type CrumbSiblings = ReturnType<typeof crumbSiblings>;
