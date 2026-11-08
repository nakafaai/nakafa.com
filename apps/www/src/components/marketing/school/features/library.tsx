import {
  File01Icon,
  Folder01Icon,
  Image01Icon,
  LibraryIcon,
  Pdf01Icon,
  Video01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Nina } from "@repo/design-system/components/ui/nina";
import type { ReactNode } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { stepVariants } from "@/components/marketing/school/features/step";
import { SchoolFeatureText } from "@/components/marketing/school/features/text";
import { FeatureCard, FeatureRow } from "@/components/marketing/shared/feature";

/** One entry of the class library: the icon of its kind, its name, and what it holds or weighs. */
function LibraryEntry({
  children,
  icon,
  name,
  step,
}: {
  children: ReactNode;
  icon: IconSvgElement;
  name: string;
  step: 1 | 2 | 3 | 4 | 5;
}) {
  return (
    <li
      className={stepVariants({
        className: "flex min-h-12 items-center gap-3 py-2",
        step,
      })}
    >
      <HugeIcons className="text-muted-foreground size-4" icon={icon} />
      <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
      <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
        {children}
      </span>
    </li>
  );
}

/**
 * The library row: one class's drive as the School library lists it, a folder
 * of the chapter first and its files under it, Nina's summary among them.
 */
export function SchoolLibrary() {
  const t = useTranslations("SchoolSite");
  const format = useFormatter();
  const size = (value: number, unit: "kilobyte" | "megabyte") =>
    format.number(value, { style: "unit", unit });

  return (
    <FeatureRow id="library" layout="end">
      <SchoolFeatureText feature="library">
        <Nina act="carrying" label="" size={88} whole />
      </SchoolFeatureText>
      <FeatureCard>
        <p className="flex min-w-0 items-center gap-2 font-medium">
          <HugeIcons className="size-4" icon={LibraryIcon} />
          <span className="truncate">{t("demo-class")}</span>
        </p>
        <ul className="-my-2 grid">
          <LibraryEntry
            icon={Folder01Icon}
            name={t("demo-library-folder")}
            step={1}
          >
            {t("demo-library-files", { count: 6 })}
          </LibraryEntry>
          <LibraryEntry
            icon={Pdf01Icon}
            name={t("demo-library-worksheet")}
            step={2}
          >
            {size(240, "kilobyte")}
          </LibraryEntry>
          <LibraryEntry
            icon={File01Icon}
            name={t("demo-library-summary")}
            step={3}
          >
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex size-6 overflow-hidden rounded-full">
                <Nina label="" lean="center" size={24} tile="yellow" />
              </span>
              {size(36, "kilobyte")}
            </span>
          </LibraryEntry>
          <LibraryEntry
            icon={Video01Icon}
            name={t("demo-library-video")}
            step={4}
          >
            {size(18, "megabyte")}
          </LibraryEntry>
          <LibraryEntry
            icon={Image01Icon}
            name={t("demo-library-formulas")}
            step={5}
          >
            {size(1.2, "megabyte")}
          </LibraryEntry>
        </ul>
      </FeatureCard>
    </FeatureRow>
  );
}
