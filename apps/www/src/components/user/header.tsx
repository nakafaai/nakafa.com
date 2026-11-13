import { PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import { useTranslations } from "use-intl";
import { BreadcrumbHeaderPath } from "@/components/shared/breadcrumb/header";
import {
  PageActions,
  PageHeader,
  PageHeaderLabel,
} from "@/components/shared/page/header";
import { ShareProfileButton } from "@/components/user/share";
import type { PublicProfile } from "@/lib/profile/public";
import { Link } from "@/lib/routing/link";
import { HOME_TARGET } from "@/lib/routing/target";
import { EXACT_ACTIVE_OPTIONS } from "@/lib/routing/tree";

/**
 * The header of a profile: the path home, and the profile's actions in one group at its end. The owner edits the
 * profile, and everyone shares a profile that is public; a school member's profile, which only its owner opens, has
 * no Share. The body draws the profile's name as its heading (`UserIntro`), so the path ends at its parent, as a
 * reading page's does.
 */
export function UserHeader({
  isOwner,
  profile,
}: {
  isOwner: boolean;
  profile: PublicProfile;
}) {
  const t = useTranslations("Auth");
  const tCommon = useTranslations("Common");

  return (
    <PageHeader>
      <BreadcrumbHeaderPath
        home={HOME_TARGET}
        homeLabel={tCommon("home")}
        items={[]}
      />
      {isOwner || profile.shareable ? (
        <PageActions>
          <ButtonGroup>
            {isOwner ? (
              <Link
                activeOptions={EXACT_ACTIVE_OPTIONS}
                className={buttonVariants({ variant: "outline" })}
                to="/$locale/user/settings"
              >
                <HugeIcons icon={PencilEdit02Icon} />
                <PageHeaderLabel>{t("edit-profile")}</PageHeaderLabel>
              </Link>
            ) : null}
            {profile.shareable ? (
              <ShareProfileButton username={profile.username} />
            ) : null}
          </ButtonGroup>
        </PageActions>
      ) : null}
    </PageHeader>
  );
}
