import {
  DiscordIcon,
  GithubIcon,
  InstagramIcon,
  Linkedin02Icon,
  YoutubeIcon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Nina } from "@repo/design-system/components/ui/nina";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { buttonVariants } from "@repo/design-system/lib/button";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import { cva } from "class-variance-authority";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { PageConsentFooterItem } from "@/components/analytics/consent/mount";
import { FooterAction } from "@/components/marketing/shared/footer/action";
import { FooterArt } from "@/components/marketing/shared/footer/art";
import {
  HEADER_SECTIONS,
  type HeaderLink,
  type HeaderSection,
} from "@/components/marketing/shared/header/sections";
import type { PageNavigation } from "@/lib/content/page/navigation";
import {
  Link,
  type LinkPreload,
  type LinkTarget,
  TargetLink,
} from "@/lib/routing/link";
import { PublicPathLink } from "@/lib/routing/public/link";
import { CONTRIBUTOR_TARGET } from "@/lib/routing/target";
import { EXACT_ACTIVE_OPTIONS } from "@/lib/routing/tree";

/**
 * The pages of one product that its footer group lists: every page the header's section holds, in the header's
 * order. A link that opens a part of a page, such as a School feature, stays in the header, so the footer lists
 * whole pages only, and a page added to the header joins the footer with it.
 */
function footerLinks(section: HeaderSection) {
  const groups: readonly HeaderGroup[] = section.groups;
  return Arr.filter(
    Arr.flatMap(groups, (group): readonly HeaderLink[] => group.links),
    (link) => !("hash" in link)
  );
}

/** One group of a header section, whichever section holds it. */
type HeaderGroup = HeaderSection["groups"][number];

/**
 * Composes the shared marketing footer from product, policy, and social links
 * without owning route generation itself. Signed Page links never preload, so
 * they load on the press (see `PageNavigation`).
 */
export function Footer({
  pageNavigation,
}: {
  pageNavigation: PageNavigation | null;
}) {
  const t = useTranslations();

  return (
    <footer className="w-full border-t" id="footer">
      <div className="mx-auto w-full max-w-7xl px-6">
        <div className="grid scroll-mt-28 grid-cols-2 gap-x-6 gap-y-12 pt-24 md:grid-cols-4">
          {Arr.map(HEADER_SECTIONS, (section) => (
            <FooterGroup key={section.key} label={t(section.label)}>
              {Arr.map(footerLinks(section), (link) => (
                <li key={link.label}>
                  <FooterLink label={t(link.label)} target={link.target} />
                </li>
              ))}
            </FooterGroup>
          ))}

          <FooterGroup label={t("About.company")}>
            <li>
              <FooterLink
                label={t("Common.contributor")}
                target={CONTRIBUTOR_TARGET}
              />
            </li>
            <li>
              <a
                className={linkItemVariants()}
                href={COMPANY_IDENTITY.socialProfiles.discord}
              >
                {t("About.community")}
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
          </FooterGroup>

          <FooterGroup label={t("Legal.terms-and-policies")}>
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
          </FooterGroup>
        </div>
      </div>

      <Link
        activeOptions={EXACT_ACTIVE_OPTIONS}
        className="hover:text-primary mx-auto flex w-full max-w-7xl px-6 py-16 transition-colors ease-out"
        to="/$locale"
      >
        <span className="hover:text-primary mx-auto text-7xl font-bold transition-colors duration-300 ease-out sm:text-8xl md:text-9xl lg:text-[12rem] xl:text-[18rem]">
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
            {t("Common.copyright", {
              year: "2026",
              companyName: COMPANY_IDENTITY.legalName,
            })}
          </p>
          <div className="flex flex-col items-center gap-4 lg:flex-row">
            <div className="flex items-center gap-1">
              {Arr.map(socialMedia, (social) => (
                <Tooltip key={social.label}>
                  <TooltipTrigger
                    render={
                      <a
                        aria-label={social.label}
                        className={buttonVariants({
                          size: "icon",
                          variant: "ghost",
                        })}
                        href={social.href}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        <HugeIcons className="size-4" icon={social.icon} />
                      </a>
                    }
                  />
                  <TooltipContent>{social.label}</TooltipContent>
                </Tooltip>
              ))}
            </div>
            <FooterAction>
              <PageConsentFooterItem />
            </FooterAction>
          </div>
        </div>
      </section>

      <FooterArt />
    </footer>
  );
}

/**
 * One group of footer links under its name. The groups follow what a visitor
 * looks for, so a new subject, article category or page joins its group's list
 * and never adds a column.
 */
function FooterGroup({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-muted-foreground text-sm font-medium">{label}</span>
      <ul className="flex flex-col gap-2">{children}</ul>
    </div>
  );
}

/**
 * The text treatment that every footer destination shares. Each link is at least
 * 24 px tall, so a finger meets one target at a time in a stacked column (WCAG
 * 2.5.8). A word longer than its column, such as German's
 * "Auftragsverarbeitungsvertrag", breaks at a syllable of the page's language,
 * or anywhere where the language has no hyphenation, so no link runs past the
 * page's edge.
 */
const linkItemVariants = cva(
  "hover:text-primary inline-flex min-h-6 items-center text-sm wrap-anywhere hyphens-auto transition-colors ease-out"
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
