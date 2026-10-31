import {
  Copy01Icon,
  School01Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { useClipboard } from "@mantine/hooks";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import { buttonVariants } from "@repo/design-system/lib/button";
import type { Mascot } from "@repo/mascot/code";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Array as Arr } from "effect";
import { useLocale, useTranslations } from "use-intl";
import { MarketingSection } from "@/components/marketing/shared/section";
import { Link } from "@/lib/routing/link";

/** How long the band says the link is copied, in milliseconds. */
const COPIED_MILLISECONDS = 1500;

/**
 * Copies the one link a new school opens from, its full address on the main site,
 * so it can be sent to anyone who runs a school (K43).
 */
function SchoolLinkCopy() {
  const t = useTranslations("SchoolStart");
  const locale = useLocale();
  const clipboard = useClipboard({ timeout: COPIED_MILLISECONDS });

  return (
    <button
      className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium underline-offset-4 hover:underline"
      onClick={() =>
        clipboard.copy(new URL(`/${locale}/school/new`, SITE_ORIGIN).href)
      }
      type="button"
    >
      <HugeIcons
        className="size-4"
        icon={clipboard.copied ? Tick01Icon : Copy01Icon}
      />
      {t(clipboard.copied ? "link-copied" : "link-copy")}
    </button>
  );
}

/**
 * The school part: a dark band with rounded corners, the words for a whole
 * school, the link that opens one with a control that copies it, the founder's
 * address for a school that wants help, and one class of different animals in a
 * row. The page gives the class, a slice of its own cast, so no animal appears
 * twice.
 */
export function Schools({ herd }: { herd: readonly (typeof Mascot.Type)[] }) {
  const t = useTranslations("Landing");
  const tCommon = useTranslations("Common");
  const tStart = useTranslations("SchoolStart");

  return (
    <MarketingSection id="school">
      <div className="mx-auto w-full max-w-7xl">
        <div className="bg-nina-ink text-nina-face grid gap-10 rounded-xl px-6 py-16 lg:grid-cols-2 lg:items-center lg:px-16">
          <div className="grid justify-items-start gap-6">
            <div className="grid gap-3">
              <h2 className="text-3xl tracking-tight text-balance sm:text-4xl">
                {t("school-title")}
              </h2>
              <p className="max-w-xl text-base text-pretty">
                {t("school-lead")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link
                className={buttonVariants({ variant: "inverse" })}
                to="/$locale/school/new"
              >
                <HugeIcons icon={School01Icon} />
                {tCommon("open-school")}
              </Link>
              <a
                className="text-sm font-medium underline-offset-4 hover:underline"
                href={`mailto:${COMPANY_IDENTITY.email}`}
                rel="noopener noreferrer"
                target="_blank"
              >
                {tStart("founder-link")}
              </a>
              <SchoolLinkCopy />
            </div>
          </div>
          <ul
            aria-label={t("school-class")}
            className="flex flex-wrap items-end justify-center gap-2"
          >
            {Arr.map(herd, (mascot) => (
              <li key={mascot.animal}>
                <PersonAvatar className="size-16" mascot={mascot} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </MarketingSection>
  );
}
