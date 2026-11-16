import { PersonAvatar } from "@repo/design-system/components/ui/person";
import type { ComponentProps } from "react";

type Mascot = NonNullable<ComponentProps<typeof PersonAvatar>["mascot"]>;

// A flat stand-in for a chosen photo: a light ground with a head and shoulders.
const PHOTO =
  "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2064%2064'%3E%3Crect%20width='64'%20height='64'%20fill='%23cfe6f7'/%3E%3Ccircle%20cx='32'%20cy='25'%20r='11'%20fill='%232f7b6e'/%3E%3Cpath%20d='M12%2064c2-14%2010-21%2020-21s18%207%2020%2021z'%20fill='%232f7b6e'/%3E%3C/svg%3E";

// Mascots of cast("Rani", 4): the animal each person has when no photo shows.
const owl: Mascot = {
  animal: "owl",
  eyes: "open",
  ground: "6d4b78",
  palette: 0,
  pose: "peek-right",
};
const panda: Mascot = {
  animal: "panda",
  eyes: "open",
  ground: "c7788a",
  palette: 0,
  pose: "peek-left",
};
const bat: Mascot = {
  animal: "bat",
  eyes: "open",
  ground: "f7d774",
  palette: 1,
  pose: "peek",
};
const tiger: Mascot = {
  animal: "tiger",
  eyes: "open",
  ground: "6d4b78",
  palette: 1,
  pose: "right",
};

export const card = {
  name: "PersonAvatar",
  group: "Identity",
  height: 140,
  source: "person",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="flex flex-wrap items-end gap-4 p-6">
      <PersonAvatar className="size-16" mascot={owl} />
      <PersonAvatar className="size-16" mascot={panda} />
      <PersonAvatar className="size-16" mascot={bat} />
      <PersonAvatar className="size-24" mascot={tiger} />
      <PersonAvatar className="size-16" mascot={owl} photo={PHOTO} />
    </div>
  );
}
