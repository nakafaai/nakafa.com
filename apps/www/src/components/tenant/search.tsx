import { useHotkeys } from "@mantine/hooks";
import { lazy } from "@repo/design-system/lib/lazy";
import { Suspense } from "react";
import { useTranslations } from "use-intl";
import { SidebarSearchButton } from "@/components/sidebar/search/button";
import { useSearch } from "@/lib/search/context";

/** The palette's code, which the first intent on the search loads. */
const TenantPalette = lazy(() =>
  import("@/components/tenant/palette").then((module) => ({
    default: module.TenantPalette,
  }))
);

/**
 * The search at the head of the school's sidebar, as the learner's sidebar has one: a press opens
 * the palette of every page, class and setting the viewer may open, and intent warms it.
 */
export function TenantSearchMenu() {
  const t = useTranslations("School");
  const { open, setOpen, warm } = useSearch((state) => ({
    open: state.open,
    setOpen: state.setOpen,
    warm: state.warm,
  }));

  return (
    <SidebarSearchButton
      label={t("search-placeholder")}
      onIntent={warm}
      onOpen={() => setOpen(true)}
      open={open}
    />
  );
}

/**
 * The palette of the school, which Command K or the slash key opens too. It stands beside the
 * sidebar and never inside it, because a phone's sidebar is a sheet that steps aside for the
 * palette and would take the palette with it. Its code loads on the first intent, and it stays
 * mounted while closed, so the press that opens it finds its body ready.
 */
export function TenantSearchPalette() {
  const { activated, open, setOpen } = useSearch((state) => ({
    activated: state.activated,
    open: state.open,
    setOpen: state.setOpen,
  }));

  useHotkeys([
    ["/", () => setOpen(true)],
    ["mod+K", () => setOpen(true)],
  ]);

  if (!activated) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <TenantPalette onOpenChange={setOpen} open={open} />
    </Suspense>
  );
}
