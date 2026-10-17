import { Animal } from "@repo/design-system/components/ui/animal";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import type { Mascot } from "@repo/mascot/code";
import type { ComponentProps } from "react";

type PersonAvatarProps = Omit<ComponentProps<typeof Avatar>, "children"> & {
  /** The animal of the person, drawn when no photo shows. Nothing is drawn without one. */
  mascot: typeof Mascot.Type | undefined;
  /** The photo that shows in place of the animal. Left out, the animal shows. */
  photo?: string | undefined;
};

/**
 * The picture of one person, always a full circle: their photo when they chose
 * it, or else their animal. Every place that shows a person draws the picture
 * through this part, so a person looks the same wherever they appear. The photo
 * has empty alternative text, because the page names the person in its text.
 */
export function PersonAvatar({ mascot, photo, ...props }: PersonAvatarProps) {
  return (
    <Avatar {...props}>
      {photo ? <AvatarImage alt="" src={photo} /> : null}
      <AvatarFallback>
        <Animal mascot={mascot} />
      </AvatarFallback>
    </Avatar>
  );
}
