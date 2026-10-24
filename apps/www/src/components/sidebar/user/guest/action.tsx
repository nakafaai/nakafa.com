import { Login03Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import { useTranslations } from "use-intl";
import { useCurrentAuthNavigation } from "@/lib/auth/location";
import { Link } from "@/lib/routing/link";

/** Renders the primary guest login action for a sidebar footer. */
export function NavUserGuestButton() {
  const t = useTranslations("Auth");
  const authNavigation = useCurrentAuthNavigation();

  return (
    <Link
      {...authNavigation.linkProps}
      className={buttonVariants({ className: "w-full" })}
    >
      <HugeIcons icon={Login03Icon} />
      {t("login-cta-action")}
    </Link>
  );
}
