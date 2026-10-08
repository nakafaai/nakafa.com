import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { tryoutStatusValidator } from "@repo/backend/confect/tryouts/status";
import { GradientBlock } from "@repo/design-system/components/ui/gradient-block";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { IntentLink } from "@repo/design-system/components/ui/intent-link";
import { cn } from "cn";
import { Schema } from "effect";
import type { ReactNode } from "react";
import {
  TryoutStatus,
  type TryoutStatusValue,
} from "@/components/tryout/status";

/** One hugeicons SVG element: a list of `[tag, attributes]` pairs. */
const IconSvgElementSchema = Schema.Array(
  Schema.Tuple([
    Schema.String,
    Schema.Record(Schema.String, Schema.Union([Schema.String, Schema.Finite])),
  ])
);

const TryoutListRowVisualSchema = Schema.Union([
  Schema.Struct({
    icon: IconSvgElementSchema,
    iconKey: Schema.String,
    kind: Schema.Literal("icon"),
  }),
  Schema.Struct({
    keyString: Schema.String,
    kind: Schema.Literal("gradient"),
  }),
]);
type TryoutListRowVisual = typeof TryoutListRowVisualSchema.Type;

const TryoutListRowSchema = Schema.Struct({
  current: Schema.optionalKey(Schema.Boolean),
  description: Schema.optionalKey(Schema.String),
  href: Schema.String,
  key: Schema.String,
  status: Schema.optionalKey(tryoutStatusValidator),
  title: Schema.String,
  visual: TryoutListRowVisualSchema,
});

/**
 * A row's optional metadata takes React nodes, which no Schema describes, so
 * its type comes from the component that renders the slot.
 */
export type TryoutListRow = typeof TryoutListRowSchema.Type &
  Partial<Parameters<typeof TryoutRowMeta>[0]>;

/** Renders the established divided try-out row list with gradient icons. */
export function TryoutList({
  emptyLabel,
  rows,
}: {
  emptyLabel: string;
  rows: readonly TryoutListRow[];
}) {
  if (rows.length === 0) {
    return (
      <section className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="px-5 py-4 text-muted-foreground text-sm">
          {emptyLabel}
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="grid divide-y">
        {rows.map((row) => (
          <TryoutRow key={row.key} row={row} />
        ))}
      </div>
    </section>
  );
}

/** Renders one production try-out list row. */
function TryoutRow({ row }: { row: TryoutListRow }) {
  return (
    <IntentLink
      className="group flex items-center gap-3 p-4 transition-colors ease-out hover:bg-accent hover:text-accent-foreground"
      href={row.href}
    >
      <div className="grid w-full gap-4">
        <div className="flex flex-1 items-start gap-3">
          <TryoutRowVisual visual={row.visual} />

          <div className="-mt-1 flex flex-1 flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3>{row.title}</h3>
              <TryoutRowStatus status={row.status} />
            </div>
            <TryoutRowMeta meta={row.meta} />
            <TryoutRowDescription description={row.description} />
          </div>

          <HugeIcons
            className={cn(
              "size-4 shrink-0 opacity-0 transition-opacity ease-out",
              "group-hover:opacity-100",
              row.current && "opacity-100"
            )}
            icon={ArrowRight02Icon}
          />
        </div>
      </div>
    </IntentLink>
  );
}

/** Renders one row status only when Convex provides it. */
function TryoutRowStatus({
  status,
}: {
  status: TryoutStatusValue | undefined;
}) {
  if (!status) {
    return null;
  }

  return <TryoutStatus status={status} />;
}

/** Renders the optional compact metadata slot. */
function TryoutRowMeta({ meta }: { readonly meta: ReactNode }) {
  if (!meta) {
    return null;
  }

  return <div className="flex flex-wrap items-center gap-2">{meta}</div>;
}

/** Renders one concise row description when authored. */
function TryoutRowDescription({
  description,
}: {
  description: string | undefined;
}) {
  if (!description) {
    return null;
  }

  return (
    <span className="line-clamp-1 text-muted-foreground text-sm group-hover:text-accent-foreground">
      {description}
    </span>
  );
}

/** Renders the configured row visual without branching at call sites. */
function TryoutRowVisual({ visual }: { visual: TryoutListRowVisual }) {
  const keyString = visual.kind === "icon" ? visual.iconKey : visual.keyString;

  return (
    <div className="relative size-10 shrink-0 overflow-hidden rounded-md">
      <GradientBlock
        className="absolute inset-0"
        colorScheme="vibrant"
        intensity="medium"
        keyString={keyString}
      />
      <TryoutRowIcon visual={visual} />
    </div>
  );
}

/** Renders an icon overlay only for icon-backed row visuals. */
function TryoutRowIcon({ visual }: { visual: TryoutListRowVisual }) {
  if (visual.kind !== "icon") {
    return null;
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <HugeIcons
        className="size-4 text-background drop-shadow-md"
        icon={visual.icon}
      />
    </div>
  );
}
