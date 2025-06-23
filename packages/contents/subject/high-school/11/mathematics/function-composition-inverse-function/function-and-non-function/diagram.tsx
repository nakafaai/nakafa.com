"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import type React from "react";
import { useMemo } from "react";

type DiagramProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

export function Diagram({ title, description, children }: DiagramProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

type Element = {
  id: string;
  label: string;
};

type Mapping = {
  from: string; // Corresponds to Element id in domain
  to: string; // Corresponds to Element id in codomain
};

type RelationVisualizerProps = {
  domain: Element[];
  codomain: Element[];
  mappings: Mapping[];
  domainLabel?: string;
  codomainLabel?: string;
};

// --- SVG Configuration ---
const svgPadding = 20; // Padding around the elements
const ellipseRx = 50; // Horizontal radius of ellipse
const ellipseRy = 90; // Vertical radius of ellipse
const ellipseGap = 100; // Gap between the two ellipses
const textPadding = 15; // Padding inside ellipse for text placement

const svgWidth = 2 * ellipseRx * 2 + ellipseGap + 2 * svgPadding;
const svgHeight = 2 * ellipseRy + 2 * svgPadding;

// Center X coordinates for the ellipses
const domainEllipseCx = svgPadding + ellipseRx;
const codomainEllipseCx = domainEllipseCx + 2 * ellipseRx + ellipseGap;
const ellipseCy = svgPadding + ellipseRy; // Y center for both ellipses

// Calculate X coordinate for text within ellipses
const domainTextX = domainEllipseCx;
const codomainTextX = codomainEllipseCx;

// Helper to calculate Text Y position dynamically within an ellipse
const calculateTextY = (
  index: number,
  total: number,
  ry: number,
  cy: number
): number => {
  // Calculate the effective height available for text
  const textHeightArea = ry * 2 - textPadding * 2;
  // Calculate the height of each slot
  const slotHeight = textHeightArea / total;
  // Calculate the center Y of the slot, offset by top padding and ellipse center
  return cy - ry + textPadding + slotHeight * (index + 0.5);
};

export function RelationVisualizer({
  domain,
  codomain,
  mappings,
  domainLabel = "X",
  codomainLabel = "Y",
}: RelationVisualizerProps) {
  // Calculate Text Y coordinates dynamically for domain and codomain
  const elementCoords = useMemo(() => {
    const coords: Record<string, { x: number; y: number }> = {};
    // Domain elements
    domain.forEach((el, index) => {
      coords[el.id] = {
        x: domainTextX,
        y: calculateTextY(index, domain.length, ellipseRy, ellipseCy),
      };
    });
    // Codomain elements
    codomain.forEach((el, index) => {
      coords[el.id] = {
        x: codomainTextX,
        y: calculateTextY(index, codomain.length, ellipseRy, ellipseCy),
      };
    });
    return coords;
  }, [domain, codomain]);

  return (
    <div className="flex justify-center py-4">
      <svg
        aria-labelledby="svgTitle" // Make SVG responsive
        height={svgHeight} // Fixed height based on ellipse Ry
        preserveAspectRatio="xMidYMid meet"
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        width="100%"
      >
        <title id="svgTitle">Arrow diagram of relation between sets</title>
        <defs>
          <marker
            id="arrowhead-visualizer" // Unique ID for this component's marker
            markerHeight="6" // Use viewBox for scaling
            markerWidth="8"
            orient="auto-start-reverse"
            refX="7" // Adjust refX so the tip is at the coordinate, line stops just before
            refY="3"
            viewBox="0 0 8 6" // Orients correctly
          >
            {/* Use foreground color */}
            <polygon className="fill-foreground/80" points="0 0, 8 3, 0 6" />
          </marker>
        </defs>

        {/* Domain Ellipse and Label */}
        <text
          className="fill-foreground font-semibold text-sm"
          textAnchor="middle" // Position label above ellipse
          x={domainEllipseCx}
          y={svgPadding - 10}
        >
          {domainLabel}
        </text>
        <ellipse
          className="fill-muted stroke-border"
          cx={domainEllipseCx}
          cy={ellipseCy}
          rx={ellipseRx}
          ry={ellipseRy}
          strokeWidth="1"
        />

        {/* Codomain Ellipse and Label */}
        <text
          className="fill-foreground font-semibold text-sm"
          textAnchor="middle" // Position label above ellipse
          x={codomainEllipseCx}
          y={svgPadding - 10}
        >
          {codomainLabel}
        </text>
        <ellipse
          className="fill-muted stroke-border"
          cx={codomainEllipseCx}
          cy={ellipseCy}
          rx={ellipseRx}
          ry={ellipseRy}
          strokeWidth="1"
        />

        {/* Domain Elements (Text) */}
        {domain.map((el) => (
          <text
            className="fill-foreground font-medium text-sm"
            dominantBaseline="middle"
            key={`domain-${el.id}`}
            textAnchor="middle"
            x={elementCoords[el.id]?.x}
            y={elementCoords[el.id]?.y}
          >
            {el.label}
          </text>
        ))}

        {/* Codomain Elements (Text) */}
        {codomain.map((el) => (
          <text
            className="fill-foreground font-medium text-sm"
            dominantBaseline="middle"
            key={`codomain-${el.id}`}
            textAnchor="middle"
            x={elementCoords[el.id]?.x}
            y={elementCoords[el.id]?.y}
          >
            {el.label}
          </text>
        ))}

        {/* Mappings (Arrows/Lines) */}
        {mappings.map((mapping, index) => {
          const startCoords = elementCoords[mapping.from];
          const endCoords = elementCoords[mapping.to];

          // Check if coordinates exist before drawing
          if (!(startCoords && endCoords)) {
            return null;
          }

          // Calculate start/end points for the line, slightly offset from text center
          const lineStartX = startCoords.x + ellipseRx * 0.3; // Start near edge of domain ellipse
          const lineEndX = endCoords.x - ellipseRx * 0.3; // End near edge of codomain ellipse

          return (
            <line
              className="stroke-foreground/50"
              key={`mapping-${mapping.from}-${mapping.to}-${index}`}
              markerEnd="url(#arrowhead-visualizer)"
              strokeWidth="1.5" // Adjusted end point for marker
              x1={lineStartX}
              x2={lineEndX}
              y1={startCoords.y}
              y2={endCoords.y}
            />
          );
        })}
      </svg>
    </div>
  );
}
