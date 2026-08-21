import {
  DiscordIcon,
  GithubIcon,
  InstagramIcon,
  Linkedin02Icon,
  YoutubeIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import { useLocale, useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { AnalyticsConsentFooterItem } from "@/components/analytics/consent/actions";
import { FooterAction } from "@/components/marketing/shared/footer-action";
import { FooterArt } from "@/components/marketing/shared/footer-art";
import { holyMenu } from "@/components/sidebar/data/holy";
import {
  getSubjectMenuHref,
  subjectMenu,
} from "@/components/sidebar/data/subject";
import type { ArticleNavigationItem } from "@/lib/content/article/navigation";
import type { PageNavigationItem } from "@/lib/content/page/navigation";

const highSchoolSubjects =
  subjectMenu.find((subject) => subject.title === "high-school")?.items || [];

/**
 * Composes the shared marketing footer from product, policy, and social links
 * without owning route generation itself.
 */
export function Footer({
  articleNavigation,
  pageNavigation,
}: {
  articleNavigation: readonly ArticleNavigationItem[];
  pageNavigation: readonly PageNavigationItem[];
}) {
  const t = useTranslations("About");
  const tLegal = useTranslations("Legal");
  const tSubject = useTranslations("Subject");
  const tHoly = useTranslations("Holy");
  const tCommon = useTranslations("Common");
  const tMarketing = useTranslations("Marketing");
  const locale = useLocale();

  return (
    <footer className="w-full border-t" id="footer">
      <div className="mx-auto w-full max-w-7xl px-6">
        <div className="grid scroll-mt-28 pt-24">
          <section className="flex flex-col justify-between gap-8 md:flex-row">
            <div className="flex flex-col gap-3">
              <span className="font-medium text-muted-foreground text-sm">
                {tCommon("subject")}
              </span>
              <ul className="flex flex-col gap-2">
                {highSchoolSubjects.map((subject) => (
                  <li key={subject.value}>
                    <LinkItem
                      href={getSubjectMenuHref(subject, locale)}
                      label={tSubject(subject.title, { grade: subject.value })}
                    />
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <span className="font-medium text-muted-foreground text-sm">
                {tHoly("holy")}
              </span>
              <ul className="flex flex-col gap-2">
                {holyMenu.map((holy) => (
                  <li key={holy.title}>
                    <LinkItem href={holy.href} label={tHoly(holy.title)} />
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <span className="font-medium text-muted-foreground text-sm">
                {tCommon("articles")}
              </span>
              <ul className="flex flex-col gap-2">
                {articleNavigation.map((article) => (
                  <li key={article.category}>
                    <LinkItem href={article.href} label={article.title} />
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <span className="font-medium text-muted-foreground text-sm">
                {t("company")}
              </span>
              <ul className="flex flex-col gap-2">
                <li>
                  <LinkItem
                    href={`/${locale}`}
                    label={t("about-us")}
                    nativeAnchor
                  />
                </li>
                <li>
                  <LinkItem
                    href={`/${locale}#pricing`}
                    label={tMarketing("pricing")}
                    nativeAnchor
                  />
                </li>
                <li>
                  <LinkItem
                    href={COMPANY_IDENTITY.socialProfiles.discord}
                    label={t("community")}
                  />
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <span className="font-medium text-muted-foreground text-sm">
                {tLegal("terms-and-policies")}
              </span>
              <ul className="flex flex-col gap-2">
                {pageNavigation.map((page) => (
                  <li key={page.pageKey}>
                    <LinkItem href={page.href} label={page.title} />
                  </li>
                ))}
                <AnalyticsConsentFooterItem />
              </ul>
            </div>
          </section>
        </div>
      </div>

      <a
        className="mx-auto flex w-full max-w-7xl px-6 py-16 transition-colors ease-out hover:text-primary"
        href={`/${locale}`}
      >
        <span className="mx-auto font-bold text-7xl transition-colors duration-300 ease-out hover:text-primary sm:text-8xl md:text-9xl lg:text-[12rem] xl:text-[18rem]">
          Nakafa
        </span>
      </a>

      <section className="w-full border-t">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 p-6 lg:flex-row">
          <p className="text-center text-sm">
            {tCommon("copyright", {
              year: "2026",
              companyName: COMPANY_IDENTITY.legalName,
            })}
          </p>
          <div className="flex flex-col items-center gap-4 lg:flex-row">
            <div className="flex items-center gap-1">
              {socialMedia.map((social) => (
                <Button
                  key={social.label}
                  nativeButton={false}
                  render={
                    <a
                      aria-label={social.label}
                      href={social.href}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <HugeIcons className="size-4" icon={social.icon} />
                      <span className="sr-only">{social.label}</span>
                    </a>
                  }
                  size="icon"
                  variant="ghost"
                />
              ))}
            </div>
            <FooterAction />
          </div>
        </div>
      </section>

      <FooterArt />
    </footer>
  );
}

type LinkItemProps =
  | {
      href: ComponentProps<typeof NavigationLink>["href"];
      label: string;
      nativeAnchor?: false;
    }
  | {
      href: string;
      label: string;
      nativeAnchor: true;
    };

/**
 * Renders one locale-aware footer destination with the shared text treatment.
 */
function LinkItem({ href, label, nativeAnchor }: LinkItemProps) {
  const className = "text-sm transition-colors ease-out hover:text-primary";

  if (nativeAnchor) {
    return (
      <a className={className} href={href}>
        {label}
      </a>
    );
  }

  return (
    <NavigationLink className={className} href={href}>
      {label}
    </NavigationLink>
  );
}

const socialMedia = [
  {
    href: COMPANY_IDENTITY.socialProfiles.youtube,
    icon: YoutubeIcon,
    label: "YouTube",
  },
  {
    href: COMPANY_IDENTITY.socialProfiles.discord,
    icon: DiscordIcon,
    label: "Discord",
  },
  {
    href: COMPANY_IDENTITY.socialProfiles.github,
    icon: GithubIcon,
    label: "GitHub",
  },
  {
    href: COMPANY_IDENTITY.socialProfiles.linkedin,
    icon: Linkedin02Icon,
    label: "LinkedIn",
  },
  {
    href: COMPANY_IDENTITY.socialProfiles.instagram,
    icon: InstagramIcon,
    label: "Instagram",
  },
];
