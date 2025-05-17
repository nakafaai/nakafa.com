"use client";

import { COLORS } from "@/lib/utils/color";
import { Text } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { FONT_PATH, MONO_FONT_PATH } from "./_data";

type Props = {
  /** Function that determines if a point satisfies the inequality */
  condition: (x: number, y: number, z: number) => boolean;
  /** Function that determines the boundary of the inequality (where the inequality becomes equality) */
  boundaryFunction?: (x: number, y: number) => number;
  /** Indicates if this is a 2D inequality (like x + y <= 10) that should be extruded along z-axis */
  is2D?: boolean;
  /** For 2D inequalities, specifies the boundary line function where ax + by + c = 0
   * as [a, b, c]. For example, x + y = 10 would be [1, 1, -10] */
  boundaryLine2D?: [number, number, number];
  /** Range for x coordinate to visualize */
  xRange?: [number, number];
  /** Range for y coordinate to visualize */
  yRange?: [number, number];
  /** Range for z coordinate to visualize */
  zRange?: [number, number];
  /** Granularity of the visualization (higher means more detailed) */
  resolution?: number;
  /** Color for the inequality region */
  color?: string | THREE.Color;
  /** Color for the boundary line/plane */
  boundaryColor?: string | THREE.Color;
  /** Opacity of the region */
  opacity?: number;
  /** Width of the boundary line */
  boundaryLineWidth?: number;
  /** Show boundary line/plane */
  showBoundary?: boolean;
  /** Optional label for the inequality */
  label?: {
    /** Text to display */
    text: string;
    /** Position for the label */
    position: [number, number, number];
    /** Color for the label text */
    color?: string | THREE.Color;
    /** Font size of the label text */
    fontSize?: number;
  };
  /** Whether to use the mono font for the labels */
  useMonoFont?: boolean;
};

export function Inequality({
  condition,
  boundaryFunction,
  is2D = false,
  boundaryLine2D,
  xRange = [-5, 5],
  yRange = [-5, 5],
  zRange = [-5, 5],
  resolution = 200,
  color = COLORS.BLUE,
  boundaryColor,
  opacity = 0.1,
  boundaryLineWidth = 2,
  showBoundary = true,
  label,
  useMonoFont = true,
}: Props) {
  const fontPath = useMonoFont ? MONO_FONT_PATH : FONT_PATH;

  // Create a buffer geometry to hold the vertices of the inequality region
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This is a complex function, but it's necessary for the inequality visualization
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const indices: number[] = [];

    // Define the step size based on resolution
    const xStep = (xRange[1] - xRange[0]) / resolution;
    const yStep = (yRange[1] - yRange[0]) / resolution;
    const zStep = (zRange[1] - zRange[0]) / resolution;

    // Helper function to add a quad (two triangles) to the geometry
    const addQuad = (
      p1: THREE.Vector3,
      p2: THREE.Vector3,
      p3: THREE.Vector3,
      p4: THREE.Vector3
    ) => {
      const index = vertices.length / 3;

      // Add vertices
      vertices.push(p1.x, p1.y, p1.z);
      vertices.push(p2.x, p2.y, p2.z);
      vertices.push(p3.x, p3.y, p3.z);
      vertices.push(p4.x, p4.y, p4.z);

      // Add indices for two triangles
      indices.push(index, index + 1, index + 2);
      indices.push(index, index + 2, index + 3);
    };

    // Helper function to create all faces of a complete cell
    const addCompleteCell = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      z1: number,
      z2: number
    ) => {
      // Create bottom face (at minimum z)
      addQuad(
        new THREE.Vector3(x1, y1, z1),
        new THREE.Vector3(x2, y1, z1),
        new THREE.Vector3(x2, y2, z1),
        new THREE.Vector3(x1, y2, z1)
      );

      // Create top face (at maximum z)
      addQuad(
        new THREE.Vector3(x1, y1, z2),
        new THREE.Vector3(x1, y2, z2),
        new THREE.Vector3(x2, y2, z2),
        new THREE.Vector3(x2, y1, z2)
      );

      // Create side faces
      // Front face (y = y1)
      addQuad(
        new THREE.Vector3(x1, y1, z1),
        new THREE.Vector3(x2, y1, z1),
        new THREE.Vector3(x2, y1, z2),
        new THREE.Vector3(x1, y1, z2)
      );

      // Back face (y = y2)
      addQuad(
        new THREE.Vector3(x1, y2, z1),
        new THREE.Vector3(x1, y2, z2),
        new THREE.Vector3(x2, y2, z2),
        new THREE.Vector3(x2, y2, z1)
      );

      // Left face (x = x1)
      addQuad(
        new THREE.Vector3(x1, y1, z1),
        new THREE.Vector3(x1, y1, z2),
        new THREE.Vector3(x1, y2, z2),
        new THREE.Vector3(x1, y2, z1)
      );

      // Right face (x = x2)
      addQuad(
        new THREE.Vector3(x2, y1, z1),
        new THREE.Vector3(x2, y2, z1),
        new THREE.Vector3(x2, y2, z2),
        new THREE.Vector3(x2, y1, z2)
      );
    };

    if (is2D && boundaryLine2D) {
      // Handle 2D inequality (like x + y <= 10) visualized as extruded along z-axis
      const [a, b, c] = boundaryLine2D;

      // Create a grid for the x-y plane, and extrude it along the z-axis
      for (let ix = 0; ix < resolution; ix++) {
        for (let iy = 0; iy < resolution; iy++) {
          const x1 = xRange[0] + ix * xStep;
          const x2 = xRange[0] + (ix + 1) * xStep;
          const y1 = yRange[0] + iy * yStep;
          const y2 = yRange[0] + (iy + 1) * yStep;

          // Check if this grid cell satisfies the inequality
          // We check all four corners to see if they satisfy the condition
          const corner1Satisfies = a * x1 + b * y1 + c <= 0;
          const corner2Satisfies = a * x2 + b * y1 + c <= 0;
          const corner3Satisfies = a * x2 + b * y2 + c <= 0;
          const corner4Satisfies = a * x1 + b * y2 + c <= 0;

          // Count the number of satisfied corners for a more nuanced approach
          const satisfiedCorners =
            (corner1Satisfies ? 1 : 0) +
            (corner2Satisfies ? 1 : 0) +
            (corner3Satisfies ? 1 : 0) +
            (corner4Satisfies ? 1 : 0);

          // Cell is on the boundary (some corners satisfy, some don't)
          if (satisfiedCorners > 0) {
            // For ultra-high resolutions, we need a completely different approach
            if (resolution >= 170) {
              // Only consider cells that are entirely inside the inequality region
              // This ensures absolute precision at the boundary
              if (satisfiedCorners === 4) {
                addCompleteCell(x1, y1, x2, y2, zRange[0], zRange[1]);
              }
              // For boundary cells, use a much stricter criterion based on distance
              else if (satisfiedCorners >= 3) {
                // Calculate the exact position on the boundary
                // For ax + by + c = 0, distance = |ax + by + c| / sqrt(a² + b²)
                const centerX = (x1 + x2) / 2;
                const centerY = (y1 + y2) / 2;
                const distanceToLine =
                  Math.abs(a * centerX + b * centerY + c) /
                  Math.sqrt(a * a + b * b);

                // Cell diagonal length (distance from corner to corner)
                const cellDiagonal = Math.sqrt(
                  (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)
                );

                // Apply an additional buffer near the boundary for perfect pixel alignment
                // This creates a small inset from the mathematical boundary to ensure precision
                const boundaryBuffer = 0.5; // Increased buffer for perfect edge

                // Only include cells that are very clearly inside the inequality region
                // This ensures no pixels extend beyond the boundary
                if (distanceToLine > cellDiagonal * (0.3 + boundaryBuffer)) {
                  addCompleteCell(x1, y1, x2, y2, zRange[0], zRange[1]);
                }
              }
            }
            // Super precise approach for high resolutions
            else if (resolution >= 120) {
              // For high resolution, only include cells that are almost entirely inside
              if (satisfiedCorners >= 3) {
                // Calculate how close the cell is to the boundary
                const centerX = (x1 + x2) / 2;
                const centerY = (y1 + y2) / 2;
                const distanceToLine =
                  Math.abs(a * centerX + b * centerY + c) /
                  Math.sqrt(a * a + b * b);

                // Cell diagonal length (distance from corner to corner)
                const cellDiagonal = Math.sqrt(
                  (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)
                );

                // If the cell center is far enough from the boundary (compared to the cell size),
                // we can safely include it without any pixels extending beyond the boundary
                if (distanceToLine > cellDiagonal * 0.1) {
                  addCompleteCell(x1, y1, x2, y2, zRange[0], zRange[1]);
                }
              }
            }
            // High resolution but not ultra-high
            else if (resolution >= 80) {
              // For high resolutions, include cells with at least 2 corners inside
              if (satisfiedCorners >= 2) {
                addCompleteCell(x1, y1, x2, y2, zRange[0], zRange[1]);
              }
            }
            // For lower resolutions, we need more flexibility to avoid gaps
            else if (satisfiedCorners >= 2) {
              addCompleteCell(x1, y1, x2, y2, zRange[0], zRange[1]);
            }
          }
        }
      }
    } else if (boundaryFunction) {
      // Handle 3D inequality (like z > f(x,y))
      // Create visualization for z-dependent inequalities
      // This approach works well for inequalities like z > f(x,y)
      for (let ix = 0; ix < resolution; ix++) {
        for (let iy = 0; iy < resolution; iy++) {
          const x1 = xRange[0] + ix * xStep;
          const x2 = xRange[0] + (ix + 1) * xStep;
          const y1 = yRange[0] + iy * yStep;
          const y2 = yRange[0] + (iy + 1) * yStep;

          // For each (x,y) pair, find the z where the condition changes from true to false
          // This is a simplification - more complex inequalities might need different approaches
          let z = zRange[0];
          while (z <= zRange[1] && !condition(x1, y1, z)) {
            z += zStep;
          }

          if (z <= zRange[1]) {
            // We found a point where the condition is true
            // Create a quad at this height
            const p1 = new THREE.Vector3(x1, y1, z);
            const p2 = new THREE.Vector3(x2, y1, z);
            const p3 = new THREE.Vector3(x2, y2, z);
            const p4 = new THREE.Vector3(x1, y2, z);

            addQuad(p1, p2, p3, p4);
          }
        }
      }
    }

    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    return geo;
  }, [
    condition,
    is2D,
    boundaryLine2D,
    boundaryFunction,
    xRange,
    yRange,
    zRange,
    resolution,
  ]);

  // Material for the inequality region
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: color instanceof THREE.Color ? color : new THREE.Color(color),
      transparent: true,
      opacity: opacity,
      side: THREE.DoubleSide,
    });
  }, [color, opacity]);

  // Generate boundary lines for rendering
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This is a complex function, but it's necessary for the inequality visualization
  const boundaryLines = useMemo(() => {
    if ((!boundaryFunction && !boundaryLine2D) || !showBoundary) {
      return [];
    }

    const lines: THREE.Vector3[][] = [];
    const xStep = (xRange[1] - xRange[0]) / resolution;
    const yStep = (yRange[1] - yRange[0]) / resolution;

    if (is2D && boundaryLine2D) {
      // For 2D inequalities, create a vertical boundary plane
      const [a, b, c] = boundaryLine2D;

      // Handle different cases based on the coefficients
      if (Math.abs(b) > 1e-10) {
        // If b ≠ 0, we can express y as a function of x: y = -(a/b)x - c/b
        const linePoints1: THREE.Vector3[] = [];
        const linePoints2: THREE.Vector3[] = [];

        for (let ix = 0; ix <= resolution; ix++) {
          const x = xRange[0] + ix * xStep;
          const y = (-a * x - c) / b;

          // Check if y is within the y-range
          if (y >= yRange[0] && y <= yRange[1]) {
            // Create two points at min and max z for this (x,y)
            linePoints1.push(new THREE.Vector3(x, y, zRange[0]));
            linePoints2.push(new THREE.Vector3(x, y, zRange[1]));
          }
        }

        if (linePoints1.length > 1) {
          lines.push(linePoints1);
        }

        if (linePoints2.length > 1) {
          lines.push(linePoints2);
        }

        // Add vertical lines connecting min z to max z at regular intervals
        for (
          let i = 0;
          i < linePoints1.length;
          i += Math.max(1, Math.floor(linePoints1.length / 5))
        ) {
          if (i < linePoints1.length && i < linePoints2.length) {
            lines.push([linePoints1[i], linePoints2[i]]);
          }
        }
      } else if (Math.abs(a) > 1e-10) {
        // If a ≠ 0, we can express x as a function of y: x = -(b/a)y - c/a
        const linePoints1: THREE.Vector3[] = [];
        const linePoints2: THREE.Vector3[] = [];

        for (let iy = 0; iy <= resolution; iy++) {
          const y = yRange[0] + iy * yStep;
          const x = (-b * y - c) / a;

          // Check if x is within the x-range
          if (x >= xRange[0] && x <= xRange[1]) {
            // Create two points at min and max z for this (x,y)
            linePoints1.push(new THREE.Vector3(x, y, zRange[0]));
            linePoints2.push(new THREE.Vector3(x, y, zRange[1]));
          }
        }

        if (linePoints1.length > 1) {
          lines.push(linePoints1);
        }

        if (linePoints2.length > 1) {
          lines.push(linePoints2);
        }

        // Add vertical lines connecting min z to max z at regular intervals
        for (
          let i = 0;
          i < linePoints1.length;
          i += Math.max(1, Math.floor(linePoints1.length / 5))
        ) {
          if (i < linePoints1.length && i < linePoints2.length) {
            lines.push([linePoints1[i], linePoints2[i]]);
          }
        }
      }
    } else if (boundaryFunction) {
      // For 3D inequalities with z = f(x,y)
      // Create lines along the x-axis at different y values
      for (let iy = 0; iy <= resolution; iy++) {
        const y = yRange[0] + iy * yStep;
        const linePoints: THREE.Vector3[] = [];

        for (let ix = 0; ix <= resolution; ix++) {
          const x = xRange[0] + ix * xStep;
          const z = boundaryFunction(x, y);

          // Check if z is within range
          if (z >= zRange[0] && z <= zRange[1]) {
            linePoints.push(new THREE.Vector3(x, y, z));
          }
        }

        if (linePoints.length > 1) {
          lines.push(linePoints);
        }
      }

      // Create lines along the y-axis at different x values
      for (let ix = 0; ix <= resolution; ix++) {
        const x = xRange[0] + ix * xStep;
        const linePoints: THREE.Vector3[] = [];

        for (let iy = 0; iy <= resolution; iy++) {
          const y = yRange[0] + iy * yStep;
          const z = boundaryFunction(x, y);

          // Check if z is within range
          if (z >= zRange[0] && z <= zRange[1]) {
            linePoints.push(new THREE.Vector3(x, y, z));
          }
        }

        if (linePoints.length > 1) {
          lines.push(linePoints);
        }
      }
    }

    return lines;
  }, [
    boundaryFunction,
    boundaryLine2D,
    is2D,
    showBoundary,
    xRange,
    yRange,
    zRange,
    resolution,
  ]);

  // Default boundary color is the same as the region color but more opaque
  const finalBoundaryColor = boundaryColor || color;

  // Combine all boundary lines into a single BufferGeometry for fewer draw calls
  const boundarySegmentsGeometry = useMemo(() => {
    if (!showBoundary || boundaryLines.length === 0) {
      return undefined;
    }
    const vertices: number[] = [];
    for (const line of boundaryLines) {
      for (let i = 0; i < line.length - 1; i++) {
        const p1 = line[i];
        const p2 = line[i + 1];
        // push each segment as two points
        vertices.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
      }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3)
    );
    return geom;
  }, [boundaryLines, showBoundary]);

  return (
    <group>
      {/* Render the shaded region */}
      <mesh geometry={geometry} material={material} />

      {/* Render the boundary as one lineSegments for better performance */}
      <lineSegments visible={showBoundary} geometry={boundarySegmentsGeometry}>
        <lineBasicMaterial
          color={finalBoundaryColor}
          linewidth={boundaryLineWidth}
        />
      </lineSegments>

      {/* Render label if provided */}
      <Text
        visible={!!label}
        position={label?.position ?? [0, 0, 0]}
        color={label?.color ?? color}
        fontSize={label?.fontSize ?? 0.5}
        anchorX="center"
        anchorY="middle"
        font={fontPath}
      >
        {label?.text}
      </Text>
    </group>
  );
}
