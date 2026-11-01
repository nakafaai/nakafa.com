import { Animal } from "@repo/design-system/components/ui/animal";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import type { Mascot } from "@repo/mascot/code";
import { type ComponentProps, type ReactNode, useState } from "react";

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
 * The photo is in the page's first HTML, so a person with a photo never shows
 * as an animal first, and a list that remounts keeps the same picture.
 */
export function PersonAvatar({ mascot, photo, ...props }: PersonAvatarProps) {
  return (
    <Avatar {...props}>
      <PersonPhoto photo={photo}>
        <AvatarFallback>
          <Animal mascot={mascot} />
        </AvatarFallback>
      </PersonPhoto>
    </Avatar>
  );
}

/**
 * The photo while it can show, or `children` without one. A photo can fail before
 * the page hydrates, when no `onError` listens yet, so the ref reads that too.
 */
function PersonPhoto({
  children,
  photo,
}: {
  children: ReactNode;
  photo: string | undefined;
}) {
  const [failed, setFailed] = useState<string>();
  if (!photo || photo === failed) {
    return children;
  }
  return (
    <AvatarImage
      onError={() => setFailed(photo)}
      ref={(image) => {
        if (image?.complete && image.naturalWidth === 0) {
          setFailed(photo);
        }
      }}
      src={photo}
    />
  );
}
