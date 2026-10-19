import { AppProviders } from "@/components/providers/app";
import { TenantHome } from "@/components/tenant/home";

/**
 * Beranda of a school host, rendered inside the school shell. A student's sittings
 * on it read Convex, and the school shell mounts no client providers, so the page
 * mounts them, as the exams and sitting layouts do.
 */
export default function SchoolHomePage() {
  return (
    <AppProviders pageNavigation={null}>
      <TenantHome />
    </AppProviders>
  );
}
