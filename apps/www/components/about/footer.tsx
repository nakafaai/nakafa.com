import {
  SiDiscord,
  SiGithub,
  SiInstagram,
  SiYoutube,
} from "@icons-pack/react-simple-icons";
import { buttonVariants } from "@repo/design-system/components/ui/button";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { cn } from "@repo/design-system/lib/utils";
import { IconBrandLinkedin } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { holyMenu } from "@/components/sidebar/_data/holy";
import { subjectMenu } from "@/components/sidebar/_data/subject";
import { articlesMenu } from "../sidebar/_data/articles";

const highSchoolSubjects =
  subjectMenu.find((subject) => subject.title === "high-school")?.items || [];
const universitySubjects =
  subjectMenu.find((subject) => subject.title === "university")?.items || [];

export function Footer() {
  const t = useTranslations("About");
  const tLegal = useTranslations("Legal");
  const tSubject = useTranslations("Subject");
  const tHoly = useTranslations("Holy");
  const tCommon = useTranslations("Common");
  const tArticles = useTranslations("Articles");

  return (
    <footer
      className="grid scroll-mt-28 rounded-xl border shadow-sm"
      id="footer"
    >
      <div className="grid">
        <section className="flex flex-col justify-between gap-6 p-6 md:flex-row">
          <div className="flex flex-col gap-2">
            <span className="font-medium text-muted-foreground text-sm">
              {tCommon("subject")}
            </span>
            <ul className="flex flex-col gap-2">
              {highSchoolSubjects.map((subject) => (
                <li key={subject.value}>
                  <LinkItem
                    href={subject.href}
                    label={tSubject(subject.title, { grade: subject.value })}
                  />
                </li>
              ))}

              {universitySubjects.map((subject) => (
                <li key={subject.title}>
                  <LinkItem
                    href={subject.href}
                    label={tSubject(subject.title)}
                  />
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-2">
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

          <div className="flex flex-col gap-2">
            <span className="font-medium text-muted-foreground text-sm">
              {tCommon("articles")}
            </span>
            <ul className="flex flex-col gap-2">
              {articlesMenu.map((article) => (
                <li key={article.title}>
                  <LinkItem
                    href={article.href}
                    label={tArticles(article.title)}
                  />
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-medium text-muted-foreground text-sm">
              {t("company")}
            </span>
            <ul className="flex flex-col gap-2">
              <li>
                <LinkItem href="/about" label={t("about-us")} />
              </li>
              <li>
                <LinkItem href="/events" label={t("events")} />
              </li>
              <li>
                <LinkItem
                  href="https://discord.gg/CPCSfKhvfQ"
                  label={t("community")}
                />
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-medium text-muted-foreground text-sm">
              {tLegal("terms-and-policies")}
            </span>
            <ul className="flex flex-col gap-2">
              <li>
                <LinkItem
                  href="/terms-of-service"
                  label={tLegal("terms-of-service")}
                />
              </li>
              <li>
                <LinkItem
                  href="/privacy-policy"
                  label={tLegal("privacy-policy")}
                />
              </li>
              <li>
                <LinkItem
                  href="/security-policy"
                  label={tLegal("security-policy")}
                />
              </li>
            </ul>
          </div>
        </section>

        <section className="mx-2 mb-2 rounded-md border bg-muted/20 py-4 md:p-2">
          <div className="flex flex-col items-center justify-between gap-2 md:flex-row">
            <div className="flex flex-wrap items-center">
              {socialMedia.map((social) => (
                <a
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "icon" })
                  )}
                  href={social.href}
                  key={social.label}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <social.icon className="size-4" />
                  <span className="sr-only">{social.label}</span>
                </a>
              ))}
            </div>

            <p className="text-balance px-2 text-center text-sm">
              {tCommon("copyright", { year: "2025" })}
            </p>
          </div>
        </section>
      </div>
    </footer>
  );
}

function LinkItem({ href, label }: { href: string; label: string }) {
  return (
    <NavigationLink
      className="text-sm transition-colors ease-out hover:text-primary"
      href={href}
    >
      {label}
    </NavigationLink>
  );
}

const socialMedia = [
  {
    href: "https://www.youtube.com/@nakafaa",
    icon: SiYoutube,
    label: "YouTube",
  },
  {
    href: "https://discord.gg/CPCSfKhvfQ",
    icon: SiDiscord,
    label: "Discord",
  },
  {
    href: "https://github.com/nakafaai",
    icon: SiGithub,
    label: "GitHub",
  },
  {
    href: "https://www.linkedin.com/company/nakafa",
    icon: IconBrandLinkedin,
    label: "LinkedIn",
  },
  {
    href: "https://www.instagram.com/nakafa.tv/",
    icon: SiInstagram,
    label: "Instagram",
  },
];
