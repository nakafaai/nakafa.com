import { useMounted } from "@mantine/hooks";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useLocation } from "@tanstack/react-router";
import { cva } from "class-variance-authority";
import { Array as Arr, Option } from "effect";
import { createContext, type ReactNode, use, useId, useState } from "react";
import { useTranslations } from "use-intl";
import { createStore, type StoreApi, useStore } from "zustand";
import { SCHOOL_FEATURES } from "@/components/marketing/school/features/list";

/** One feature of the School, by the key its section and its header link carry. */
type Feature = (typeof SCHOOL_FEATURES)[number]["key"];

/** The feature the reader pressed, with the hash the page had then, so a later header link opens its own. */
const createPick = () =>
  createStore<{
    readonly pick: (feature: Feature, hash: string) => void;
    readonly picked: Option.Option<{ feature: Feature; hash: string }>;
  }>()((set) => ({
    pick: (feature, hash) => set({ picked: Option.some({ feature, hash }) }),
    picked: Option.none(),
  }));

/** The features of one switch, its ids, and what the reader pressed. */
const SwitchContext = createContext<{
  readonly features: Arr.NonEmptyReadonlyArray<Feature>;
  readonly id: string;
  readonly store: StoreApi<
    ReturnType<ReturnType<typeof createPick>["getState"]>
  >;
} | null>(null);

function useSwitch() {
  const value = use(SwitchContext);
  if (value === null) {
    throw new Error("A feature panel must be used within FeatureSwitch");
  }
  return value;
}

/**
 * The open feature: the one the reader pressed, until a header link names another, then the one the link names, and
 * the first one otherwise. The page's HTML holds the first, so the switch reads the link only once React has taken
 * the page over, and hydration finds what the server drew.
 */
function useOpenFeature() {
  const { features, store } = useSwitch();
  const mounted = useMounted();
  const hash = useLocation({ select: (location) => location.hash });
  const picked = useStore(store, (state) => state.picked);
  if (!mounted) {
    return Arr.headNonEmpty(features);
  }
  return Option.getOrElse(
    Option.orElse(
      Option.flatMap(picked, (pick) =>
        pick.hash === hash ? Option.some(pick.feature) : Option.none()
      ),
      () => Arr.findFirst(features, (feature) => feature === hash)
    ),
    () => Arr.headNonEmpty(features)
  );
}

const panelVariants = cva(
  "col-start-1 row-start-1 grid min-w-0 scroll-mt-24 content-start transition-[opacity,translate,visibility] duration-200 ease-out motion-reduce:transition-none",
  {
    variants: {
      open: {
        false: "invisible translate-y-2 opacity-0",
        true: "visible translate-y-0 opacity-100",
      },
    },
  }
);

/**
 * Several features of the School in one part of the landing: a button group that names each one with the icon and
 * the name the header gives it, and their screens in one cell under it, so the part is as tall as its tallest screen
 * and a switch moves nothing below it. A header link to one of them opens it here, since each screen carries the
 * feature's key as its id.
 */
export function FeatureSwitch({
  children,
  features,
  label,
}: {
  /** The screens, one `FeaturePanel` for each feature. */
  children: ReactNode;
  features: Arr.NonEmptyReadonlyArray<Feature>;
  /** The name of the button group for a screen reader. */
  label: string;
}) {
  const id = useId();
  const [store] = useState(createPick);

  return (
    <SwitchContext value={{ features, id, store }}>
      <div className="grid grid-cols-1 gap-6">
        <ButtonGroup aria-label={label} className="w-full">
          {Arr.map(
            Arr.filter(SCHOOL_FEATURES, (each) =>
              Arr.contains(features, each.key)
            ),
            (feature) => (
              <FeatureButton feature={feature} key={feature.key} />
            )
          )}
        </ButtonGroup>
        <div className="grid grid-cols-1">{children}</div>
      </div>
    </SwitchContext>
  );
}

/** One feature's button: its icon, and its name from the small width up. The open feature's is pressed, and a press opens it. */
function FeatureButton({
  feature,
}: {
  feature: (typeof SCHOOL_FEATURES)[number];
}) {
  const t = useTranslations("Marketing");
  const { id, store } = useSwitch();
  const open = useOpenFeature() === feature.key;
  const pick = useStore(store, (state) => state.pick);
  const hash = useLocation({ select: (location) => location.hash });
  const name = t(`school-${feature.key}`);

  return (
    <Button
      aria-controls={feature.key}
      aria-pressed={open}
      className="flex-1"
      id={`${id}-${feature.key}`}
      onClick={() => pick(feature.key, hash)}
      title={name}
      variant="outline"
    >
      <HugeIcons icon={feature.icon} />
      <span className="sr-only sm:not-sr-only">{name}</span>
    </Button>
  );
}

/**
 * One feature's screen. A screen that is not open is hidden by visibility and made inert, so it leaves the
 * accessibility tree and takes no pointer or focus, and keeps its box, so a header link still finds it.
 */
export function FeaturePanel({
  children,
  feature,
}: {
  children: ReactNode;
  feature: Feature;
}) {
  const { id } = useSwitch();
  const open = useOpenFeature() === feature;

  return (
    <section
      aria-labelledby={`${id}-${feature}`}
      className={panelVariants({ open })}
      id={feature}
      inert={!open}
    >
      {children}
    </section>
  );
}
