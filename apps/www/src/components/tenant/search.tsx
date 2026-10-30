import { useHotkeys } from "@mantine/hooks";
import { lazy, Suspense, useState } from "react";
import { useTranslations } from "use-intl";
import { SidebarSearchButton } from "@/components/sidebar/search/trigger";

/** The palette's code, which the first intent on the search loads. */
const TenantPalette = lazy(() =>
  import("@/components/tenant/palette").then((module) => ({
    default: module.TenantPalette,
  }))
);

/**
 * The search at the head of the school's sidebar, as the learner's sidebar has one:
 * a press, Command K or the slash key opens the palette of every page, class and
 * setting the viewer may open. Its code loads on the first intent, and the palette
 * stays mounted while closed, so the press that opens it finds its body ready.
 */
export function TenantSearch() {
  const t = useTranslations("School");
  const [activated, setActivated] = useState(false);
  const [open, setOpen] = useState(false);

  function show() {
    setActivated(true);
    setOpen(true);
  }

  useHotkeys([
    ["/", show],
    ["mod+K", show],
  ]);

  return (
    <>
      <SidebarSearchButton
        label={t("search-placeholder")}
        onIntent={() => setActivated(true)}
        onOpen={show}
        open={open}
      />
      {activated ? (
        <Suspense fallback={null}>
          <TenantPalette onOpenChange={setOpen} open={open} />
        </Suspense>
      ) : null}
    </>
  );
}
