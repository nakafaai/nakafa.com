import {
  BookOpen01Icon,
  Settings01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
} from "@repo/design-system/components/ui/command";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr } from "effect";

const groups = [
  {
    value: "Pages",
    items: [
      { icon: BookOpen01Icon, label: "Lessons" },
      { icon: UserGroupIcon, label: "Classes" },
      { icon: Settings01Icon, label: "Settings" },
    ],
  },
];

export const card = {
  name: "Command",
  group: "Navigation",
  height: 300,
  source: "components/ui/command",
};

/** The search palette: one field over grouped places, each with the icon of its kind. */
export function Preview() {
  return (
    <div className="max-w-md p-6">
      <Command>
        <CommandInput clearLabel="Clear search" placeholder="Search Nakafa" />
        <CommandPanel>
          <CommandEmpty>Nothing matches.</CommandEmpty>
          <CommandList>
            {Arr.map(groups, (group) => (
              <CommandGroup key={group.value}>
                <CommandGroupLabel>{group.value}</CommandGroupLabel>
                {Arr.map(group.items, (item) => (
                  <CommandItem key={item.label} value={item.label}>
                    <HugeIcons icon={item.icon} />
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </CommandPanel>
      </Command>
    </div>
  );
}
