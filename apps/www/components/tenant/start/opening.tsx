import { schoolMascot } from "@repo/backend/confect/tenancy/mascot";
import { MAIN_DOMAIN } from "@repo/next-config/domains";
import { SchoolMark } from "@/components/tenant/mark";

/**
 * The school as it opens: its animal, its name and its address, shown the moment
 * the founder finishes, before the server answers (K44). The animal follows from
 * the address, so it is the one the school keeps.
 */
export function StartOpening({ name, slug }: { name: string; slug: string }) {
  return (
    <output className="motion-safe:fade-in-0 motion-safe:zoom-in-95 flex w-full max-w-md flex-col items-center gap-4 text-center motion-safe:animate-in motion-safe:duration-200">
      <SchoolMark logo={undefined} mascot={schoolMascot(slug)} size="lg" />
      <span className="grid gap-1">
        <span className="wrap-anywhere text-balance font-semibold text-xl">
          {name}
        </span>
        <span className="break-all text-muted-foreground text-sm">
          {slug}.{MAIN_DOMAIN}
        </span>
      </span>
    </output>
  );
}
