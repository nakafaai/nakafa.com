import {
  BookOpen01Icon,
  Settings01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import {
  Command,
  CommandCollection,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
} from "@repo/design-system/components/ui/command";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";

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
      <Command
        items={groups}
        itemToStringValue={(item: (typeof groups)[number]["items"][number]) =>
          item.label
        }
      >
        <CommandInput clearLabel="Clear search" placeholder="Search Nakafa" />
        <CommandPanel>
          <CommandEmpty>Nothing matches.</CommandEmpty>
          <CommandList>
            {(group: (typeof groups)[number]) => (
              <CommandGroup items={group.items} key={group.value}>
                <CommandGroupLabel>{group.value}</CommandGroupLabel>
                <CommandCollection>
                  {(item: (typeof groups)[number]["items"][number]) => (
                    <CommandItem key={item.label} value={item}>
                      <HugeIcons icon={item.icon} />
                      {item.label}
                    </CommandItem>
                  )}
                </CommandCollection>
              </CommandGroup>
            )}
          </CommandList>
        </CommandPanel>
      </Command>
    </div>
  );
}
