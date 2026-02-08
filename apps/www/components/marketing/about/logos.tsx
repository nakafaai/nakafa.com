import { GraduationScrollIcon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { schools } from "./constants/logos";

interface SchoolLogoProps {
  school: (typeof schools)[number];
}

function SchoolLogo({ school }: SchoolLogoProps) {
  return (
    <a
      aria-label={school.name}
      className="group/logo relative flex h-28 w-56 shrink-0 items-center justify-center px-6 transition-opacity duration-300 hover:opacity-100"
      href={school.href}
      rel="noopener noreferrer"
      target="_blank"
    >
      <div className="flex items-center gap-3">
        <div className="relative aspect-square size-12 shrink-0">
          <Image
            alt={school.alt}
            className="object-contain"
            fill
            sizes="48px"
            src={school.logo}
            title={school.name}
          />
        </div>
        <span className="text-balance font-medium text-sm">{school.name}</span>
      </div>
    </a>
  );
}

export function Logos() {
  const t = useTranslations("About");
  const duplicatedSchools = [...schools, ...schools];

  return (
    <section className="grid scroll-mt-28 gap-12 py-24" id="logos">
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-6">
        <div className="grid gap-6">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-sm">
              <HugeIcons className="size-4" icon={GraduationScrollIcon} />
              {t("trusted-badge")}
            </span>
          </div>

          <h2 className="max-w-4xl text-balance font-medium text-3xl tracking-tight sm:text-4xl">
            {t.rich("trusted-headline", {
              mark: (chunks) => <mark>{chunks}</mark>,
            })}
          </h2>

          <p className="max-w-xl text-pretty text-lg text-muted-foreground md:text-xl">
            {t("trusted-description")}
          </p>
        </div>
      </div>

      <div className="group relative w-full overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-1 w-24 bg-linear-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-1 w-24 bg-linear-to-l from-background to-transparent" />

        <div className="group/logos hover:paused mx-auto flex w-max animate-marquee">
          {duplicatedSchools.map((school, index) => (
            <div
              className="shrink-0 transition-opacity duration-300 ease-out hover:opacity-100! group-hover/logos:opacity-60"
              key={`${school.href}-${index}`}
            >
              <SchoolLogo school={school} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
