import type { AnyAppUser } from "@repo/backend/convex/auth";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { getInitialName } from "@/lib/utils/helper";

type Props = {
  user: AnyAppUser;
};

export function UserHeader({ user }: Props) {
  return (
    <section className="flex items-start gap-4 text-left">
      <Avatar className="size-12 rounded-full sm:size-18">
        <AvatarImage alt={user.name} src={user.image ?? ""} />
        <AvatarFallback className="rounded-lg">
          {getInitialName(user.name)}
        </AvatarFallback>
      </Avatar>
      <div className="grid text-left">
        <span className="truncate font-semibold text-base sm:text-lg">
          {user.name}
        </span>
        <span className="truncate text-muted-foreground text-sm sm:text-base">
          {user.email}
        </span>
      </div>
    </section>
  );
}
