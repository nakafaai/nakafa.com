import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { cn } from "@repo/design-system/lib/utils";
import type { ReactNode } from "react";

type NumberLineSegment = {
  /** The start value of the segment */
  start: number;
  /** The end value of the segment */
  end: number;
  /** Whether the start value is inclusive */
  startInclusive?: boolean;
  /** Whether the end value is inclusive */
  endInclusive?: boolean;
  /** The label of the segment */
  label?: string;
  /** Whether the segment is shaded */
  shaded?: boolean;
  /** Whether the segment should show points */
  showPoints?: boolean;
  /** The background color of the segment */
  backgroundColor?: string;
};

type NumberLineProps = {
  min?: number;
  max?: number;
  segments: NumberLineSegment[];
  title: ReactNode;
  description: ReactNode;
};

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

    let roundedClass = "rounded";
    if (isStartInfinity && isEndInfinity) {
      roundedClass = "";
    } else if (isStartInfinity) {
      roundedClass = "rounded-r";
    } else if (isEndInfinity) {
      roundedClass = "rounded-l";
    }

    return {
      ...segment,
      startPos,
      endPos,
      width,
      shaded,
      bgColor,
      showPoints,
      roundedClass,
      index,
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mx-auto">
          <div className="relative h-20 w-full">
            <div className="absolute top-1/2 h-0.25 w-full bg-foreground" />

            {processedSegments.map((segment) => (
              <div key={`bg-${segment.start}-${segment.end}-${segment.index}`}>
                {segment.shaded && (
                  <div
                    className={cn(
                      "-translate-y-1/2 absolute top-1/2 h-8",
                      !segment.bgColor && "bg-secondary/30",
                      segment.roundedClass
                    )}
                    style={{
                      left: `${segment.startPos}%`,
                      width: `${segment.width}%`,
                      ...(segment.bgColor && {
                        backgroundColor: segment.bgColor,
                      }),
                    }}
                  />
                )}
              </div>
            ))}

            {processedSegments.map((segment) => (
              <div
                key={`label-${segment.start}-${segment.end}-${segment.index}`}
              >
                {segment.label && (
                  <div
                    className="-translate-x-1/2 absolute top-0 font-medium text-sm"
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
                {segment.showPoints && (
                  <>
                    {Number.isFinite(segment.start) && (
                      <div
                        className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2"
                        style={{ left: `${segment.startPos}%` }}
                      >
                        <div
                          className={cn(
                            "size-4 rounded-full border border-foreground",
                            segment.startInclusive
                              ? "bg-foreground"
                              : "bg-background"
                          )}
                        />
                        <div className="-translate-x-1/2 absolute top-6 left-1/2 whitespace-nowrap text-sm">
                          <InlineMath math={segment.start.toString()} />
                        </div>
                      </div>
                    )}

                    {Number.isFinite(segment.end) && (
                      <div
                        className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2"
                        style={{ left: `${segment.endPos}%` }}
                      >
                        <div
                          className={cn(
                            "size-4 rounded-full border border-foreground",
                            segment.endInclusive
                              ? "bg-foreground"
                              : "bg-background"
                          )}
                        />
                        <div className="-translate-x-1/2 absolute top-6 left-1/2 whitespace-nowrap text-sm">
                          <InlineMath math={segment.end.toString()} />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
