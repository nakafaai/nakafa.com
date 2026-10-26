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
import { COMPANY_IDENTITY } from "@repo/seo/company";
import { cva } from "class-variance-authority";
import { Array as Arr, Option } from "effect";
import { useTranslations } from "use-intl";
import { PageConsentFooterItem } from "@/components/analytics/consent/mount";
import { FooterAction } from "@/components/marketing/shared/footer/action";
import { FooterArt } from "@/components/marketing/shared/footer/art";
import { holyMenu } from "@/components/sidebar/data/holy";
import {
  getSubjectMenuTarget,
  subjectMenu,
} from "@/components/sidebar/data/subject";
import type { ArticleNavigationItem } from "@/lib/content/article/navigation";
import type { PageNavigation } from "@/lib/content/page/navigation";
import {
  Link,
  type LinkPreload,
  type LinkTarget,
  TargetLink,
  useCurrentLocale,
} from "@/lib/routing/link";
import { PublicPathLink } from "@/lib/routing/public/link";
import {
  articleCategoryTarget,
  LANDING_TARGET,
  PRICING_TARGET,
} from "@/lib/routing/target";
import { EXACT_ACTIVE_OPTIONS } from "@/lib/routing/tree";

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
                    <FooterLink
                      label={tSubject(subject.title, { grade: subject.value })}
                      target={getSubjectMenuTarget(subject, locale)}
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
                    <FooterLink
                      label={tHoly(holy.title)}
                      target={holy.target}
                    />
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
                    <FooterLink
                      label={article.title}
                      target={articleCategoryTarget(article.route)}
                    />
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
                  <FooterLink label={t("about-us")} target={LANDING_TARGET} />
                </li>
                <li>
                  <FooterLink
                    label={tMarketing("pricing")}
                    target={PRICING_TARGET}
                  />
                </li>
                <li>
                  <a
                    className={linkItemVariants()}
                    href={COMPANY_IDENTITY.socialProfiles.discord}
                  >
                    {t("community")}
                  </a>
                </li>
                {pageNavigation ? (
                  <li>
                    <FooterPageLink
                      label={pageNavigation.developerItem.title}
                      preload={false}
                      publicPath={pageNavigation.developerItem.publicPath}
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
                      <FooterPageLink
                        label={page.title}
                        preload={false}
                        publicPath={page.publicPath}
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

/** The text treatment that every footer destination shares. */
const linkItemVariants = cva(
  "text-sm transition-colors ease-out hover:text-primary"
);

/** One footer link of the app, at a route target that the app chose. */
function FooterLink({ label, ...link }: { target: LinkTarget; label: string }) {
  return (
    <TargetLink className={linkItemVariants()} {...link}>
      {label}
    </TargetLink>
  );
}

/** One footer destination of the signed Pages, which the reader may preload only on intent. */
function FooterPageLink({
  label,
  preload,
  ...link
}: {
  label: string;
  preload?: LinkPreload | undefined;
  publicPath: string;
}) {
  return (
    <PublicPathLink
      className={linkItemVariants()}
      {...link}
      {...(preload === undefined ? {} : { preload })}
    >
      {label}
    </PublicPathLink>
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
