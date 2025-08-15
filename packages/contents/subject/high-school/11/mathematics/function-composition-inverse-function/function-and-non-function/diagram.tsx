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

const SVG_PADDING = 20;
const ELLIPSE_RX = 50;
const ELLIPSE_RY = 90;
const ELLIPSE_GAP = 100;
const TEXT_PADDING = 15;
const LINE_OFFSET = 0.3;
const SLOT_CENTER_OFFSET = 0.5;

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
const svgWidth = 2 * ELLIPSE_RX * 2 + ELLIPSE_GAP + 2 * SVG_PADDING;
const svgHeight = 2 * ELLIPSE_RY + 2 * SVG_PADDING;

// Center X coordinates for the ellipses
const domainEllipseCx = SVG_PADDING + ELLIPSE_RX;
const codomainEllipseCx = domainEllipseCx + 2 * ELLIPSE_RX + ELLIPSE_GAP;
const ellipseCy = SVG_PADDING + ELLIPSE_RY; // Y center for both ellipses

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
  const textHeightArea = ry * 2 - TEXT_PADDING * 2;
  // Calculate the height of each slot
  const slotHeight = textHeightArea / total;
  // Calculate the center Y of the slot, offset by top padding and ellipse center
  return cy - ry + TEXT_PADDING + slotHeight * (index + SLOT_CENTER_OFFSET);
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
        y: calculateTextY(index, domain.length, ELLIPSE_RY, ellipseCy),
      };
    });
    // Codomain elements
    codomain.forEach((el, index) => {
      coords[el.id] = {
        x: codomainTextX,
        y: calculateTextY(index, codomain.length, ELLIPSE_RY, ellipseCy),
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
          y={SVG_PADDING - 10}
        >
          {domainLabel}
        </text>
        <ellipse
          className="fill-muted stroke-border"
          cx={domainEllipseCx}
          cy={ellipseCy}
          rx={ELLIPSE_RX}
          ry={ELLIPSE_RY}
          strokeWidth="1"
        />

        {/* Codomain Ellipse and Label */}
        <text
          className="fill-foreground font-semibold text-sm"
          textAnchor="middle" // Position label above ellipse
          x={codomainEllipseCx}
          y={SVG_PADDING - 10}
        >
          {codomainLabel}
        </text>
        <ellipse
          className="fill-muted stroke-border"
          cx={codomainEllipseCx}
          cy={ellipseCy}
          rx={ELLIPSE_RX}
          ry={ELLIPSE_RY}
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
          const lineStartX = startCoords.x + ELLIPSE_RX * LINE_OFFSET; // Start near edge of domain ellipse
          const lineEndX = endCoords.x - ELLIPSE_RX * LINE_OFFSET; // End near edge of codomain ellipse

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
