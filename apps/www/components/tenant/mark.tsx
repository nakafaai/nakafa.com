import { PersonAvatar } from "@repo/design-system/components/ui/person";
import type { Mascot } from "@repo/mascot/code";
import Image from "next/image";

/**
 * The mark of a school at the top of its sidebar: its logo in the frame of the
 * Nakafa mark, or else its animal in a round frame, drawn the way a person's
 * animal is. The logo is decorative, because the school's name sits beside it.
 */
export function SchoolMark({
  logo,
  mascot,
}: {
  logo: string | undefined;
  mascot: typeof Mascot.Type;
}) {
  if (logo === undefined) {
    return <PersonAvatar mascot={mascot} />;
  }
  return (
    <div className="relative aspect-square size-8">
      <Image
        alt=""
        className="rounded-sm border object-contain"
        fill
        sizes="32px"
        src={logo}
      />
    </div>
  );
}
