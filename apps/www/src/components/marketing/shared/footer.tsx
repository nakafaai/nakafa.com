import {
  DiscordIcon,
  GithubIcon,
  InstagramIcon,
  Linkedin02Icon,
  YoutubeIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Nina } from "@repo/design-system/components/ui/nina";
import {
  EXACT_ACTIVE_OPTIONS,
  HrefLink,
  Link,
  useCurrentLocale,
} from "@repo/internationalization/src/link";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import { cva } from "class-variance-authority";
import { Array as Arr, Option } from "effect";
import type { ComponentProps } from "react";
import { useTranslations } from "use-intl";
import { PageConsentFooterItem } from "@/components/analytics/consent/mount";
import { FooterAction } from "@/components/marketing/shared/footer/action";
import { FooterArt } from "@/components/marketing/shared/footer/art";
import { holyMenu } from "@/components/sidebar/data/holy";
import {
  getSubjectMenuHref,
  subjectMenu,
} from "@/components/sidebar/data/subject";
import type { ArticleNavigationItem } from "@/lib/content/article/navigation";
import type { PageNavigation } from "@/lib/content/page/navigation";

const highSchoolSubjects = Option.getOrElse(
  Option.map(
    Arr.findFirst(subjectMenu, (subject) => subject.title === "high-school"),
    (subject) => subject.items || []
  ),
  () => []
);

/**
 * Composes the shared marketing footer from product, policy, and social links
 * without owning route generation itself. Signed Page links never preload, so
 * they load on the press (see `PageNavigation`).
 */
export function Footer({
  articleNavigation,
  pageNavigation,
}: {
  articleNavigation: readonly ArticleNavigationItem[];
  pageNavigation: PageNavigation | null;
}) {
  const t = useTranslations("About");
  const tLegal = useTranslations("Legal");
  const tSubject = useTranslations("Subject");
  const tHoly = useTranslations("Holy");
  const tCommon = useTranslations("Common");
  const tMarketing = useTranslations("Marketing");
  const locale = useCurrentLocale();

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
                {Arr.map(highSchoolSubjects, (subject) => (
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
                {Arr.map(holyMenu, (holy) => (
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
                {Arr.map(articleNavigation, (article) => (
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
                  <LinkItem href="/" label={t("about-us")} />
                </li>
                <li>
                  <LinkItem href="/pricing" label={tMarketing("pricing")} />
                </li>
                <li>
                  <LinkItem
                    href={COMPANY_IDENTITY.socialProfiles.discord}
                    label={t("community")}
                  />
                </li>
                {pageNavigation ? (
                  <li>
                    <LinkItem
                      href={pageNavigation.developerItem.href}
                      label={pageNavigation.developerItem.title}
                      preload={false}
                    />
                  </li>
                ) : null}
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <span className="font-medium text-muted-foreground text-sm">
                {tLegal("terms-and-policies")}
              </span>
              <ul className="flex flex-col gap-2">
                {pageNavigation &&
                  Arr.map(pageNavigation.legalItems, (page) => (
                    <li key={page.pageKey}>
                      <LinkItem
                        href={page.href}
                        label={page.title}
                        preload={false}
                      />
                    </li>
                  ))}
                <PageConsentFooterItem />
              </ul>
            </div>
          </section>
        </div>
      </div>

      <Link
        activeOptions={EXACT_ACTIVE_OPTIONS}
        className="mx-auto flex w-full max-w-7xl px-6 py-16 transition-colors ease-out hover:text-primary"
        params={{ locale }}
        to="/$locale"
      >
        <span className="mx-auto font-bold text-7xl transition-colors duration-300 ease-out hover:text-primary sm:text-8xl md:text-9xl lg:text-[12rem] xl:text-[18rem]">
          Nakafa
        </span>
      </Link>

      <section className="relative w-full border-t">
        {/* Nina looks over the line under the large name, at the end of the
            page's own width, as the identity's Footer card draws her: the line
            is the edge that cuts her off. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-full mx-auto flex w-full max-w-7xl justify-end px-6 lg:px-10">
          <div aria-hidden="true">
            <Nina act="greeting" label="" lean="peek" size={150} />
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 p-6 lg:flex-row">
          <p className="text-center text-sm">
            {tCommon("copyright", {
              year: "2026",
              companyName: COMPANY_IDENTITY.legalName,
            })}
          </p>
          <div className="flex flex-col items-center gap-4 lg:flex-row">
            <div className="flex items-center gap-1">
              {Arr.map(socialMedia, (social) => (
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

interface LinkItemProps {
  href: string;
  label: string;
  preload?: ComponentProps<typeof HrefLink>["preload"];
}

/** The text treatment that every footer destination shares. */
const linkItemVariants = cva(
  "text-sm transition-colors ease-out hover:text-primary"
);

/**
 * Renders one locale-aware footer destination with the shared text treatment.
 */
function LinkItem({ href, label, preload }: LinkItemProps) {
  return (
    <HrefLink
      className={linkItemVariants()}
      href={href}
      {...(preload !== undefined && { preload })}
    >
      {label}
    </HrefLink>
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
