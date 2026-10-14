import { cva, type VariantProps } from "class-variance-authority";
import { Array as Arr } from "effect";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  type School,
  schools,
} from "@/components/marketing/about/constants/schools";

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

/** The fill of each ribbon, in turn. */
const RIBBON_TONES: readonly RibbonTone[] = [
  "orange",
  "blue",
  "green",
  "red",
  "primary",
  "yellow",
];

/** How far each medal's swing starts after the one before it, in seconds. */
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

/** One school on its ribbon, with its logo when the wall has one, and its mark when not. */
function Medal({
  index,
  school,
  tone,
}: {
  index: number;
  school: School;
  tone: RibbonTone;
}) {
  return (
    <li className="grid justify-items-center border-t">
      <span
        aria-label={school.name}
        className="transform-fill grid origin-top justify-items-center motion-safe:animate-thing-sway"
        role="img"
        style={{ animationDelay: `${index * SWING_STEP}s` }}
      >
        <Ribbon tone={tone} />
        <span className="-mt-3 grid size-16 place-items-center rounded-full border bg-background">
          {school.logo === undefined ? (
            <span className="font-medium text-xs">{school.mark}</span>
          ) : (
            <Image
              alt=""
              className="size-8 object-contain"
              height={32}
              src={school.logo}
              width={32}
            />
          )}
        </span>
      </span>
    </li>
  );
}

/**
 * The wall of schools and campuses as medals on rails: seven to a rail, three on
 * a phone. The last hook is empty and asks about the learner's own school.
 */
export function Medals() {
  const t = useTranslations("Landing");

  return (
    <section className="scroll-mt-28 px-6 py-20 lg:px-10 lg:py-32" id="medals">
      <div className="mx-auto grid w-full max-w-7xl gap-12">
        <h2 className="text-balance text-3xl tracking-tight sm:text-4xl">
          {t("medals-title")}
        </h2>
        <ul
          aria-label={t("medals-label")}
          className="grid grid-cols-3 gap-y-10 sm:grid-cols-7"
        >
          {Arr.map(schools, (school, index) => (
            <Medal
              index={index}
              key={school.name}
              school={school}
              tone={Arr.getUnsafe(RIBBON_TONES, index % RIBBON_TONES.length)}
            />
          ))}
          <li className="grid justify-items-center border-t pt-10">
            <span className="grid size-16 place-items-center rounded-full border border-dashed text-center text-muted-foreground text-sm">
              {t("medals-hook")}
            </span>
          </li>
        </ul>
      </div>
    </section>
  );
}
