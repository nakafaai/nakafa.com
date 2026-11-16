import { BookOpen01Icon, School01Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@repo/design-system/components/ui/navigation";

export const card = {
  name: "NavigationMenu",
  group: "Navigation",
  height: 260,
  source: "components/ui/navigation",
};

/** The site header's sections, whose links open in one shared popup on hover or press. */
export function Preview() {
  return (
    <div className="p-6">
      <NavigationMenu defaultValue="learn">
        <NavigationMenuList>
          <NavigationMenuItem value="learn">
            <NavigationMenuTrigger>Learn</NavigationMenuTrigger>
            <NavigationMenuContent>
              <div className="grid gap-1 p-2">
                <NavigationMenuLink href="#">
                  <HugeIcons icon={BookOpen01Icon} />
                  Lessons
                </NavigationMenuLink>
                <NavigationMenuLink href="#">
                  <HugeIcons icon={School01Icon} />
                  Nakafa School
                </NavigationMenuLink>
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem value="school">
            <NavigationMenuTrigger>School</NavigationMenuTrigger>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  );
}
