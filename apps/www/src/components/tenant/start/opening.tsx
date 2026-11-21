import { schoolMascot } from "@repo/backend/confect/tenancy/mascot";
import { MAIN_DOMAIN } from "@repo/site/domains";
import { SchoolMark } from "@/components/tenant/mark";

/**
 * The school as it opens: its animal, its name and its address, shown the moment
 * the founder finishes, before the server answers (K44). The animal follows from
 * the address, so it is the one the school keeps.
 */
export function StartOpening({ name, slug }: { name: string; slug: string }) {
  return (
    <output className="flex w-full max-w-md flex-col items-center gap-4 text-center transition-[opacity,scale] duration-200 ease-out motion-reduce:transition-none starting:opacity-0 motion-safe:starting:scale-95">
      <SchoolMark logo={undefined} mascot={schoolMascot(slug)} size="lg" />
      <span className="grid gap-1">
        <span className="text-xl font-semibold text-balance wrap-anywhere">
          {name}
        </span>
        <span className="text-muted-foreground text-sm break-all">
          {slug}.{MAIN_DOMAIN}
        </span>
      </span>
    </output>
  );
}
