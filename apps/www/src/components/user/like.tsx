import { FavouriteIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "cn";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { FeedCount } from "@/components/user/feed";
import { useCurrentAuthNavigation } from "@/lib/auth/location";

/**
 * Runs an action for a signed-in learner. A visitor who has not signed in goes to
 * the sign-in page, which returns to the page they were on.
 */
export function useWhenSignedIn() {
  const navigate = useNavigate();
  const authNavigation = useCurrentAuthNavigation();
  const signedOut = useConvexAuth(
    (auth) => !(auth.isAuthenticated || auth.isLoading)
  );

  return function whenSignedIn(action: () => void) {
    if (signedOut) {
      navigate(authNavigation.readTarget());
      return;
    }
    action();
  };
}

/**
 * The like toggle of a post or a comment, at its own width: the heart, and the count
 * once it is above zero. The change is made at once and the server answers after it.
 * The ghost variant recolors the icon on hover, so a liked heart keeps its color with
 * a rule of its own.
 */
export function LikeButton({
  liked,
  likeCount,
  onToggle,
}: {
  liked: boolean;
  likeCount: number;
  onToggle: () => void;
}) {
  const t = useTranslations("Common");
  const whenSignedIn = useWhenSignedIn();

  return (
    <Button
      aria-label={t("like")}
      aria-pressed={liked}
      className={cn(liked && "hover:[&_svg]:text-destructive")}
      onClick={() => whenSignedIn(onToggle)}
      size="sm"
      variant="ghost"
    >
      <HugeIcons
        className={cn(liked && "text-destructive [&_path]:fill-current")}
        icon={FavouriteIcon}
      />
      <FeedCount value={likeCount} />
    </Button>
  );
}
