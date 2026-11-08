import type { Face } from "@repo/backend/confect/classroom/forum/face";
import {
  Avatar,
  AvatarFallback,
} from "@repo/design-system/components/ui/avatar";
import { Nina } from "@repo/design-system/components/ui/nina";
import { PersonAvatar } from "@repo/design-system/components/ui/person";

/** The pixels of Nina's head in each avatar size, which the avatar's round frame cuts. */
const NINA_SIZE = { default: 32, sm: 24 };

/**
 * The round picture of one person of the forum: their photo or their animal, through the one part that draws a
 * person, or Nina's head for her replies. The name always stands beside it in text, so the picture says nothing to a
 * screen reader.
 */
export function ForumFace({
  className,
  face,
  size = "default",
}: {
  className?: string;
  face: typeof Face.Type;
  size?: "default" | "sm";
}) {
  if (face.nina) {
    return (
      <Avatar aria-hidden="true" className={className} size={size}>
        <AvatarFallback>
          <Nina label="" size={NINA_SIZE[size]} />
        </AvatarFallback>
      </Avatar>
    );
  }
  return (
    <PersonAvatar
      aria-hidden="true"
      className={className}
      mascot={face.mascot}
      photo={face.photo ?? undefined}
      size={size}
    />
  );
}
