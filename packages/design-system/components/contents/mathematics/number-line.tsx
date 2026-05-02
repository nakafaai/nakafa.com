import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { cn } from "@repo/design-system/lib/utils";
import { cva } from "class-variance-authority";
import type { ReactNode } from "react";

const numberLineSegmentVariants = cva("absolute top-1/2 h-8 -translate-y-1/2", {
  variants: {
    edge: {
      bothInfinity: "",
      endInfinity: "rounded-l-sm",
      finite: "rounded-sm",
      startInfinity: "rounded-r-sm",
    },
  },
  defaultVariants: {
    edge: "finite",
  },
});

const NUMBER_LINE_SEGMENT_EDGE = {
  bothInfinity: "bothInfinity",
  endInfinity: "endInfinity",
  finite: "finite",
  startInfinity: "startInfinity",
} as const;

interface NumberLineSegment {
  /** The background color of the segment */
  backgroundColor?: string;
  /** The end value of the segment */
  end: number;
  /** Whether the end value is inclusive */
  endInclusive?: boolean;
  /** Custom label for the end point (e.g., fraction in LaTeX) */
  endLabel?: ReactNode;
  /** The label of the segment */
  label?: ReactNode;
  /** Whether the segment is shaded */
  shaded?: boolean;
  /** Whether the segment should show points */
  showPoints?: boolean;
  /** The start value of the segment */
  start: number;
  /** Whether the start value is inclusive */
  startInclusive?: boolean;
  /** Custom label for the start point (e.g., fraction in LaTeX) */
  startLabel?: ReactNode;
}

interface NumberLineProps {
  description: ReactNode;
  max?: number;
  min?: number;
  segments: NumberLineSegment[];
  title: ReactNode;
}

/**
 * Selects the segment end-cap shape from infinite bounds.
 */
function getSegmentEdge({
  isStartInfinity,
  isEndInfinity,
}: {
  isEndInfinity: boolean;
  isStartInfinity: boolean;
}) {
  if (isStartInfinity && isEndInfinity) {
    return NUMBER_LINE_SEGMENT_EDGE.bothInfinity;
  }

  if (isStartInfinity) {
    return NUMBER_LINE_SEGMENT_EDGE.startInfinity;
  }

  if (isEndInfinity) {
    return NUMBER_LINE_SEGMENT_EDGE.endInfinity;
  }

  return NUMBER_LINE_SEGMENT_EDGE.finite;
}

export function NumberLine({
  min,
  max,
  segments,
  title,
  description,
}: NumberLineProps) {
  const allValues = segments
    .flatMap((s) => [s.start, s.end])
    .filter((v) => Number.isFinite(v));

  const rangeMin = min ?? (allValues.length > 0 ? Math.min(...allValues) : -10);
  const rangeMax = max ?? (allValues.length > 0 ? Math.max(...allValues) : 10);
  const range = rangeMax - rangeMin;

  const padding = range * 0.15;
  const paddedMin = rangeMin - padding;
  const paddedMax = rangeMax + padding;
  const paddedRange = paddedMax - paddedMin;

  const getPosition = (value: number) => {
    if (value === Number.NEGATIVE_INFINITY) {
      return 0;
    }
    if (value === Number.POSITIVE_INFINITY) {
      return 100;
    }
    return ((value - paddedMin) / paddedRange) * 100;
  };

  const processedSegments = segments.map((segment, index) => {
    const startPos = getPosition(segment.start);
    const endPos = getPosition(segment.end);
    const width = endPos - startPos;

    const shaded = segment.shaded ?? true;
    const bgColor = segment.backgroundColor;

    const isStartInfinity = segment.start === Number.NEGATIVE_INFINITY;
    const isEndInfinity = segment.end === Number.POSITIVE_INFINITY;

    const showPoints =
      segment.showPoints ?? !(isStartInfinity || isEndInfinity);

    return {
      ...segment,
      startPos,
      endPos,
      width,
      shaded,
      bgColor,
      showPoints,
      edge: getSegmentEdge({ isStartInfinity, isEndInfinity }),
      index,
    };
  });

  return (
    <Card className="content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mx-auto">
          <div className="relative h-20 w-full">
            {processedSegments.map((segment) => (
              <div key={`bg-${segment.start}-${segment.end}-${segment.index}`}>
                {!!segment.shaded && (
                  <div
                    className={cn(
                      numberLineSegmentVariants({ edge: segment.edge }),
                      !segment.bgColor && "bg-chart-1/80"
                    )}
                    style={{
                      left: `${segment.startPos}%`,
                      width: `${segment.width}%`,
                      ...(!!segment.bgColor && {
                        backgroundColor: segment.bgColor,
                      }),
                    }}
                  />
                )}
              </div>
            ))}

            <div className="absolute top-1/2 h-px w-full bg-foreground" />

            {processedSegments.map((segment) => (
              <div
                key={`label-${segment.start}-${segment.end}-${segment.index}`}
              >
                {!!segment.label && (
                  <div
                    className="absolute top-0 -translate-x-1/2 font-medium text-sm"
                    style={{ left: `${segment.startPos + segment.width / 2}%` }}
                  >
                    {segment.label}
                  </div>
                )}
              </div>
            ))}

            {processedSegments.map((segment) => (
              <div
                key={`points-${segment.start}-${segment.end}-${segment.index}`}
              >
                {Number.isFinite(segment.start) &&
                  (segment.showPoints || segment.startLabel) && (
                    <div
                      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${segment.startPos}%` }}
                    >
                      {!!segment.showPoints && (
                        <div
                          className={cn(
                            "size-4 rounded-full border border-foreground",
                            segment.startInclusive
                              ? "bg-foreground"
                              : "bg-background"
                          )}
                        />
                      )}
                      <div className="absolute top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-sm">
                        {segment.startLabel ?? (
                          <InlineMath math={segment.start.toString()} />
                        )}
                      </div>
                    </div>
                  )}

                {Number.isFinite(segment.end) &&
                  (segment.showPoints || segment.endLabel) && (
                    <div
                      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${segment.endPos}%` }}
                    >
                      {!!segment.showPoints && (
                        <div
                          className={cn(
                            "size-4 rounded-full border border-foreground",
                            segment.endInclusive
                              ? "bg-foreground"
                              : "bg-background"
                          )}
                        />
                      )}
                      <div className="absolute top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-sm">
                        {segment.endLabel ?? (
                          <InlineMath math={segment.end.toString()} />
                        )}
                      </div>
                    </div>
                  )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
