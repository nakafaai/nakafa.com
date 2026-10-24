import {
  ArrowRight01Icon,
  DiscordIcon,
  FavouriteIcon,
  FileValidationIcon,
  InformationCircleIcon,
  LinkSquare02Icon,
  LockIcon,
} from "@hugeicons/core-free-icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { useSidebar } from "@repo/design-system/lib/sidebar/context";
import { COMPANY_SOCIAL_PROFILES } from "@repo/seo/company-profiles";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { useNavigate } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactNode } from "react";
import { useLocale, useTranslations } from "use-intl";
import { selectMenuSide } from "@/components/sidebar/menu/side";
import { usePageNavigation } from "@/lib/content/page/context";
import { useCurrentLocale } from "@/lib/routing/link";
import { publicPathTarget } from "@/lib/routing/target";

/**
 * The Learn more submenu of an account menu, listed beside Language and Theme. The
 * menu that opens it composes its rows, so each surface lists the pages it can
 * open, and the rows open the same way the rest of that menu does.
 */
export function LearnMoreSubmenu({ children }: { children: ReactNode }) {
  const t = useTranslations("Common");
  const side = useSidebar(selectMenuSide);

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="cursor-pointer">
        <HugeIcons icon={InformationCircleIcon} />
        <span className="truncate">{t("learn-more")}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent
        className="w-max max-w-[calc(100vw-2rem)]"
        side={side}
      >
        <DropdownMenuGroup>{children}</DropdownMenuGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

/**
 * The Learn more menu of a visitor's sidebar. It opens on hover, as the language
 * menu beside it does, and composes the same rows as the account's submenu.
 */
export function GuestLearnMoreMenu({ children }: { children: ReactNode }) {
  const t = useTranslations("Common");
  const side = useSidebar(selectMenuSide);
  const label = t("learn-more");

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger
          openOnHover
          render={
            <SidebarMenuButton title={label}>
              <HugeIcons icon={InformationCircleIcon} />
              <span className="truncate">{label}</span>
              <HugeIcons
                className="ml-auto opacity-80"
                data-slot="learn-more-indicator"
                icon={ArrowRight01Icon}
              />
            </SidebarMenuButton>
          }
        />
        <DropdownMenuContent
          align="start"
          className="w-max max-w-[calc(100vw-2rem)]"
          side={side}
          sideOffset={4}
        >
          <DropdownMenuGroup>{children}</DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}

/** Opens the app's About page inside the app. */
export function NakafaAboutMenuItem() {
  const t = useTranslations("Common");
  const navigate = useNavigate();
  const locale = useCurrentLocale();

  return (
    <DropdownMenuItem
      className="cursor-pointer"
      onClick={() => navigate({ params: { locale }, to: "/$locale" })}
    >
      <HugeIcons icon={FavouriteIcon} />
      {t("about-nakafa")}
    </DropdownMenuItem>
  );
}

/**
 * Opens the About page of the main site. A school's host has no app pages of its
 * own, so its menu leaves the school for the main site as its other links do.
 */
export function SiteAboutMenuItem() {
  const t = useTranslations("Common");
  const locale = useLocale();

  return (
    <DropdownMenuItem
      className="cursor-pointer"
      render={
        <a href={new URL(`/${locale}`, SITE_ORIGIN).href}>
          <HugeIcons icon={FavouriteIcon} />
          {t("about-nakafa")}
        </a>
      }
    />
  );
}

/** Opens the Nakafa community on Discord in a new tab. */
export function CommunityMenuItem() {
  const t = useTranslations("Common");

  return (
    <DropdownMenuItem
      className="cursor-pointer"
      render={(props) => (
        <a
          {...props}
          href={COMPANY_SOCIAL_PROFILES.discord}
          rel="noopener noreferrer"
          target="_blank"
        >
          <HugeIcons icon={DiscordIcon} />
          {t("community")}
          <HugeIcons className="ml-auto size-4" icon={LinkSquare02Icon} />
        </a>
      )}
    />
  );
}

/**
 * The Terms of Service and Privacy Policy rows, which open their pages of the app.
 * A surface without the page catalog lists neither.
 */
export function LegalMenuItems() {
  const tLegal = useTranslations("Legal");
  const navigate = useNavigate();
  const pageNavigation = usePageNavigation((navigation) => navigation);

  if (!pageNavigation) {
    return null;
  }

  /** Opens one signed Page of the app inside it. */
  function openPage(publicPath: string) {
    Option.map(publicPathTarget(publicPath), (target) => navigate(target));
  }

  return (
    <>
      <DropdownMenuItem
        className="cursor-pointer"
        onClick={() => openPage(pageNavigation.termsOfServicePath)}
      >
        <HugeIcons icon={FileValidationIcon} />
        {tLegal("terms-of-service")}
      </DropdownMenuItem>
      <DropdownMenuItem
        className="cursor-pointer"
        onClick={() => openPage(pageNavigation.privacyPolicyPath)}
      >
        <HugeIcons icon={LockIcon} />
        {tLegal("privacy-policy")}
      </DropdownMenuItem>
    </>
  );
}
