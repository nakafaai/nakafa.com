import { Particles } from "@repo/design-system/components/ui/particles";

import { Suspense } from "react";
import { School } from "@/components/school";
import { SchoolLoader } from "@/components/school/loader";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function Page() {
  return (
    <Suspense fallback={<SchoolLoader />}>
      <School>
        <div className="relative flex h-svh items-center justify-center">
          <Particles className="pointer-events-none absolute inset-0 opacity-80" />
          <div className="mx-auto w-full max-w-xl px-6">
            <ComingSoon />
          </div>
        </div>
      </School>
    </Suspense>
  );
}
