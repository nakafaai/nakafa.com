import { Image } from "@repo/design-system/components/image";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import type { Mascot } from "@repo/mascot/code";
import { cva } from "class-variance-authority";
import { cn } from "cn";

/** The two sizes of a school's mark: beside its name in the sidebar, and large on the sign-in page and in the logo settings. */
const markVariants = cva("", {
  defaultVariants: { size: "sm" },
  variants: { size: { lg: "size-24", sm: "size-8" } },
});

/**
 * The mark of a school: its logo in the frame of the Nakafa mark, or else its animal in
 * a round frame, drawn the way a person's animal is. It sits small beside the school's
 * name in the sidebar, and large above the title of the school's sign-in page. The logo
 * is decorative, because the school's name is always beside it or under it. It is small and
 * stands beside a name, so it loads with the page and paints with its row, as a person's
 * picture does: a phone's sidebar draws it in a sheet that mounts as it opens, and the
 * copy beside the page, hidden on a phone, has already fetched it.
 */
export function SchoolMark({
  logo,
  mascot,
  size = "sm",
}: {
  logo: string | undefined;
  mascot: typeof Mascot.Type;
  size?: "lg" | "sm";
}) {
  if (logo === undefined) {
    return <PersonAvatar className={markVariants({ size })} mascot={mascot} />;
  }
  return (
    <div className={cn("relative aspect-square", markVariants({ size }))}>
      <Image
        alt=""
        className="rounded-sm border object-contain"
        decoding="sync"
        fill
        loading="eager"
        sizes={size === "lg" ? "96px" : "32px"}
        src={logo}
      />
    </div>
  );
}
