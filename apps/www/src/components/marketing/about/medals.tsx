import { FavouriteIcon } from "@hugeicons/core-free-icons";
import { useIntersection } from "@mantine/hooks";
import { Image } from "@repo/design-system/components/image";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cva, type VariantProps } from "class-variance-authority";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import {
  type School,
  schools,
} from "@/components/marketing/about/constants/schools";
import { MarketingSection } from "@/components/marketing/shared/section";

/** The fill of a ribbon. Each fill is a token, so both themes keep it. */
const ribbonFill = cva("", {
  variants: {
    tone: {
      blue: "fill-pop-blue",
      green: "fill-pop-green",
      orange: "fill-pop-orange",
      primary: "fill-primary",
      red: "fill-pop-red",
      yellow: "fill-pop-yellow",
    },
  },
});

/** The name of one ribbon fill. */
type RibbonTone = NonNullable<VariantProps<typeof ribbonFill>["tone"]>;

/**
 * The swing of a medal. The media query decides it in CSS, so a reader who asks
 * for less motion gets still medals from the server's first paint, before any
 * script runs.
 */
const medalSwing = cva(
  "transform-fill grid origin-top justify-items-center will-change-transform motion-safe:animate-thing-sway"
);

/** The fill of each ribbon, in turn. */
const RIBBON_TONES: readonly RibbonTone[] = [
  "orange",
  "blue",
  "green",
  "red",
  "primary",
  "yellow",
];

/**
 * How far each medal's swing is ahead of the one before it, in seconds. The delay
 * is negative on purpose: a positive delay holds the medal at rest, outside its
 * animation, and then snaps it to the first frame of its swing, which read as a
 * shake on the first open. A negative delay starts each swing part way along its
 * path, so every medal moves from the first frame.
 */
const SWING_STEP = 0.35;

/** Two strips that cross over the medal, as a ribbon hangs. */
function Ribbon({ tone }: { tone: RibbonTone }) {
  const className = ribbonFill({ tone });
  return (
    <svg aria-hidden="true" className="h-10 w-9" viewBox="0 0 36 40">
      <path className={className} d="M3,0 H15 L24,40 H12 Z" />
      <path
        className={className}
        d="M33,0 H21 L12,40 H24 Z"
        fillOpacity="0.72"
      />
    </svg>
  );
}

/** One school on its ribbon, its logo on the medal and its name under it. */
function Medal({
  index,
  paused,
  school,
  tone,
}: {
  index: number;
  paused: boolean;
  school: School;
  tone: RibbonTone;
}) {
  return (
    <li className="grid content-start justify-items-center gap-3 border-t">
      <span
        aria-hidden="true"
        className={medalSwing()}
        style={{
          animationDelay: `${-index * SWING_STEP}s`,
          animationPlayState: paused ? "paused" : "running",
        }}
      >
        <Ribbon tone={tone} />
        {/* The medal's face is white in every theme, so every logo reads on it. */}
        <span className="-mt-3 grid size-16 place-items-center rounded-full bg-white ring-1 ring-black/10 dark:ring-white/10">
          <Image
            alt=""
            className="size-10 object-contain"
            height={40}
            src={school.logo}
            width={40}
          />
        </span>
      </span>
      <span className="max-w-28 text-balance text-center text-sm leading-5">
        {school.name}
      </span>
    </li>
  );
}

/**
 * The wall of schools and campuses as medals on rails, each with its name under
 * it: seven to a rail, three on a phone. The last hook is empty and asks about the learner's own school. The
 * medals swing while the wall is on screen, and hang still with reduced motion.
 */
export function Medals() {
  const t = useTranslations("Landing");
  const { entry, ref } = useIntersection({ threshold: 0 });
  const paused = !(entry?.isIntersecting ?? false);

  return (
    <MarketingSection id="medals">
      <div className="mx-auto grid w-full max-w-4xl gap-12">
        <h2 className="text-balance text-center text-3xl tracking-tight sm:text-4xl">
          {t("medals-title")}
        </h2>
        <ul
          aria-label={t("medals-label")}
          className="grid grid-cols-3 gap-y-8 sm:grid-cols-7"
          ref={ref}
        >
          {Arr.map(schools, (school, index) => (
            <Medal
              index={index}
              key={school.name}
              paused={paused}
              school={school}
              tone={Arr.getUnsafe(RIBBON_TONES, index % RIBBON_TONES.length)}
            />
          ))}
          <li className="grid content-start justify-items-center gap-3 border-t pt-10">
            <span
              aria-hidden="true"
              className="grid size-16 place-items-center rounded-full border border-dashed text-muted-foreground"
            >
              <HugeIcons className="size-5" icon={FavouriteIcon} />
            </span>
            <span className="text-center text-muted-foreground text-sm leading-5">
              {t("medals-hook")}
            </span>
          </li>
        </ul>
      </div>
    </MarketingSection>
  );
}
