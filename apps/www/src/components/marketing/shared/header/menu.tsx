import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@repo/design-system/components/ui/navigation-menu";
import { cva } from "class-variance-authority";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import {
  HEADER_SECTIONS,
  type HeaderLink,
  type HeaderSection,
} from "@/components/marketing/shared/header/sections";
import { TargetLink } from "@/lib/routing/link";

/** The width of a group of links: a wide group lays its links out in two columns. */
const groupVariants = cva("grid content-start gap-0.5", {
  variants: {
    wide: {
      false: "w-52",
      true: "w-104 grid-cols-2",
    },
  },
});

/** One link of an open section: its icon and its name. A press opens the page and closes the menu. */
function HeaderMenuLink({ link }: { link: HeaderLink }) {
  const t = useTranslations();

  return (
    <NavigationMenuLink
      closeOnClick
      render={
        <TargetLink
          hash={"hash" in link ? link.hash : undefined}
          target={link.target}
        />
      }
    >
      <HugeIcons icon={link.icon} />
      {t(link.label)}
    </NavigationMenuLink>
  );
}

/** What an open section shows: each group under its one-word name, side by side. */
function HeaderMenuGroups({ section }: { section: HeaderSection }) {
  const t = useTranslations();

  return (
    <div className="flex gap-2">
      {Arr.map(section.groups, (group) => (
        <div className="grid content-start gap-1" key={group.label}>
          <p className="text-muted-foreground px-2 py-1.5 text-xs font-medium">
            {t(group.label)}
          </p>
          <div className={groupVariants({ wide: group.wide })}>
            {Arr.map(group.links, (link) => (
              <HeaderMenuLink key={link.label} link={link} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The header's sections from `lg`: the learner's Nakafa and Nakafa School, each
 * a trigger whose links open in one popup when a pointer rests on it or it is
 * pressed, so a visitor moves between the two products from any page.
 */
export function HeaderMenu() {
  const t = useTranslations();

  return (
    <NavigationMenu className="max-lg:hidden">
      <NavigationMenuList>
        {Arr.map(HEADER_SECTIONS, (section) => (
          <NavigationMenuItem key={section.key} value={section.key}>
            <NavigationMenuTrigger>{t(section.label)}</NavigationMenuTrigger>
            <NavigationMenuContent>
              <HeaderMenuGroups section={section} />
            </NavigationMenuContent>
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  );
}
