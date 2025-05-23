"use client";

import { isMobileDevice } from "@/lib/utils";
import { COLORS } from "@/lib/utils/color";
import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { FONT_PATH, MONO_FONT_PATH } from "./_data";

type Props = {
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

// Performance optimization: Adaptive resolution based on device capabilities
function getAdaptiveResolution(requestedResolution: number): number {
  // Check device capabilities
  const isMobile = isMobileDevice();
  const cores = navigator.hardwareConcurrency || 4;

  if (isMobile || cores < 4) {
    return Math.min(requestedResolution, 50);
  }
  if (cores >= 8) {
    return requestedResolution;
  }
  return Math.min(requestedResolution, 100);
}

export function Inequality({
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
  const groupRef = useRef<THREE.Group>(null);

  // Adaptive resolution for performance
  const adaptiveResolution = getAdaptiveResolution(resolution);

  // Create optimized buffer geometry for the inequality region
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This is a complex function, but it's necessary for the inequality visualization
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const vertices: Float32Array = new Float32Array(
      adaptiveResolution * adaptiveResolution * 36 * 3
    ); // Pre-allocate
    const indices: Uint32Array = new Uint32Array(
      adaptiveResolution * adaptiveResolution * 36
    ); // Pre-allocate
    let vertexIndex = 0;
    let indexOffset = 0;

    // Define the step size based on resolution
    const xStep = (xRange[1] - xRange[0]) / adaptiveResolution;
    const yStep = (yRange[1] - yRange[0]) / adaptiveResolution;

    // Helper function to add a quad (two triangles) to the geometry - optimized
    const addQuad = (
      p1x: number,
      p1y: number,
      p1z: number,
      p2x: number,
      p2y: number,
      p2z: number,
      p3x: number,
      p3y: number,
      p3z: number,
      p4x: number,
      p4y: number,
      p4z: number
    ) => {
      const index = vertexIndex / 3;

      // Add vertices directly to array
      vertices[vertexIndex++] = p1x;
      vertices[vertexIndex++] = p1y;
      vertices[vertexIndex++] = p1z;
      vertices[vertexIndex++] = p2x;
      vertices[vertexIndex++] = p2y;
      vertices[vertexIndex++] = p2z;
      vertices[vertexIndex++] = p3x;
      vertices[vertexIndex++] = p3y;
      vertices[vertexIndex++] = p3z;
      vertices[vertexIndex++] = p4x;
      vertices[vertexIndex++] = p4y;
      vertices[vertexIndex++] = p4z;

      // Add indices for two triangles
      indices[indexOffset++] = index;
      indices[indexOffset++] = index + 1;
      indices[indexOffset++] = index + 2;
      indices[indexOffset++] = index;
      indices[indexOffset++] = index + 2;
      indices[indexOffset++] = index + 3;
    };

    // Helper function to create all faces of a complete cell - optimized
    const addCompleteCell = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      z1: number,
      z2: number
    ) => {
      // Only add visible faces for performance (basic culling)
      // Bottom face (at minimum z)
      addQuad(x1, y1, z1, x2, y1, z1, x2, y2, z1, x1, y2, z1);

      // Top face (at maximum z)
      addQuad(x1, y1, z2, x1, y2, z2, x2, y2, z2, x2, y1, z2);

      // Side faces - only if on boundary
      if (Math.abs(x1 - xRange[0]) < xStep) {
        // Left face
        addQuad(x1, y1, z1, x1, y1, z2, x1, y2, z2, x1, y2, z1);
      }
      if (Math.abs(x2 - xRange[1]) < xStep) {
        // Right face
        addQuad(x2, y1, z1, x2, y2, z1, x2, y2, z2, x2, y1, z2);
      }
      if (Math.abs(y1 - yRange[0]) < yStep) {
        // Front face
        addQuad(x1, y1, z1, x2, y1, z1, x2, y1, z2, x1, y1, z2);
      }
      if (Math.abs(y2 - yRange[1]) < yStep) {
        // Back face
        addQuad(x1, y2, z1, x1, y2, z2, x2, y2, z2, x2, y2, z1);
      }
    };

    if (is2D && boundaryLine2D) {
      // Handle 2D inequality (like x + y <= 10) visualized as extruded along z-axis
      const [a, b, c] = boundaryLine2D;

      // Optimized grid traversal with early termination
      for (let ix = 0; ix < adaptiveResolution; ix++) {
        for (let iy = 0; iy < adaptiveResolution; iy++) {
          const x1 = xRange[0] + ix * xStep;
          const x2 = xRange[0] + (ix + 1) * xStep;
          const y1 = yRange[0] + iy * yStep;
          const y2 = yRange[0] + (iy + 1) * yStep;

          // Quick check using center point for better performance
          const centerX = (x1 + x2) / 2;
          const centerY = (y1 + y2) / 2;
          const centerValue = a * centerX + b * centerY + c;

          // If center is far from boundary, we can make a quick decision
          const cellDiagonal = Math.sqrt(
            (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)
          );
          const distanceToLine =
            Math.abs(centerValue) / Math.sqrt(a * a + b * b);

          if (centerValue <= 0 && distanceToLine > cellDiagonal) {
            // Fully inside - add cell
            addCompleteCell(x1, y1, x2, y2, zRange[0], zRange[1]);
          } else if (centerValue <= 0 || distanceToLine < cellDiagonal * 2) {
            // Near boundary - check corners
            const corner1Satisfies = a * x1 + b * y1 + c <= 0;
            const corner2Satisfies = a * x2 + b * y1 + c <= 0;
            const corner3Satisfies = a * x2 + b * y2 + c <= 0;
            const corner4Satisfies = a * x1 + b * y2 + c <= 0;

            const satisfiedCorners =
              (corner1Satisfies ? 1 : 0) +
              (corner2Satisfies ? 1 : 0) +
              (corner3Satisfies ? 1 : 0) +
              (corner4Satisfies ? 1 : 0);

            if (
              satisfiedCorners >= 3 ||
              (satisfiedCorners >= 2 && adaptiveResolution < 80)
            ) {
              addCompleteCell(x1, y1, x2, y2, zRange[0], zRange[1]);
            }
          }
        }
      }
    } else if (boundaryFunction) {
      // Handle 3D inequality (like z > f(x,y)) - simplified for performance
      for (let ix = 0; ix < adaptiveResolution; ix += 2) {
        // Skip every other cell for performance
        for (let iy = 0; iy < adaptiveResolution; iy += 2) {
          const x1 = xRange[0] + ix * xStep;
          const x2 = xRange[0] + (ix + 2) * xStep;
          const y1 = yRange[0] + iy * yStep;
          const y2 = yRange[0] + (iy + 2) * yStep;

          // Sample the center point
          const centerX = (x1 + x2) / 2;
          const centerY = (y1 + y2) / 2;
          const zBoundary = boundaryFunction(centerX, centerY);

          if (zBoundary >= zRange[0] && zBoundary <= zRange[1]) {
            // Create a quad at the boundary
            addQuad(
              x1,
              y1,
              zBoundary,
              x2,
              y1,
              zBoundary,
              x2,
              y2,
              zBoundary,
              x1,
              y2,
              zBoundary
            );
          }
        }
      }
    }

    // Trim arrays to actual size used
    const finalVertices = new Float32Array(vertices.buffer, 0, vertexIndex);
    const finalIndices = new Uint32Array(indices.buffer, 0, indexOffset);

    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(finalVertices, 3)
    );
    geo.setIndex(new THREE.BufferAttribute(finalIndices, 1));
    geo.computeVertexNormals();

    return geo;
  }, [
    is2D,
    boundaryLine2D,
    boundaryFunction,
    xRange,
    yRange,
    zRange,
    adaptiveResolution,
  ]);

  // Material for the inequality region with performance optimizations
  const material = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: color instanceof THREE.Color ? color : new THREE.Color(color),
      transparent: true,
      opacity: opacity,
      side: THREE.DoubleSide,
      depthWrite: false, // Better transparency handling
    });
  }, [color, opacity]);

  // Generate boundary lines for rendering - optimized
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This is a complex function, but it's necessary for the inequality visualization
  const boundarySegmentsGeometry = useMemo(() => {
    if ((!boundaryFunction && !boundaryLine2D) || !showBoundary) {
      return undefined;
    }

    const vertices: number[] = [];
    const lineResolution = Math.min(adaptiveResolution, 50); // Lower resolution for lines
    const xStep = (xRange[1] - xRange[0]) / lineResolution;
    const yStep = (yRange[1] - yRange[0]) / lineResolution;

    if (is2D && boundaryLine2D) {
      // For 2D inequalities, create a vertical boundary plane
      const [a, b, c] = boundaryLine2D;

      // Create boundary lines more efficiently
      if (Math.abs(b) > 1e-10) {
        // Express y as a function of x
        for (let ix = 0; ix <= lineResolution; ix++) {
          const x = xRange[0] + ix * xStep;
          const y = (-a * x - c) / b;

          if (y >= yRange[0] && y <= yRange[1] && ix > 0) {
            const prevX = xRange[0] + (ix - 1) * xStep;
            const prevY = (-a * prevX - c) / b;
            if (prevY >= yRange[0] && prevY <= yRange[1]) {
              // Bottom edge
              vertices.push(prevX, prevY, zRange[0], x, y, zRange[0]);
              // Top edge
              vertices.push(prevX, prevY, zRange[1], x, y, zRange[1]);
            }
          }
        }

        // Add vertical connectors
        for (
          let i = 0;
          i <= lineResolution;
          i += Math.floor(lineResolution / 4)
        ) {
          const x = xRange[0] + i * xStep;
          const y = (-a * x - c) / b;
          if (y >= yRange[0] && y <= yRange[1]) {
            vertices.push(x, y, zRange[0], x, y, zRange[1]);
          }
        }
      } else if (Math.abs(a) > 1e-10) {
        // Express x as a function of y
        for (let iy = 0; iy <= lineResolution; iy++) {
          const y = yRange[0] + iy * yStep;
          const x = (-b * y - c) / a;

          if (x >= xRange[0] && x <= xRange[1] && iy > 0) {
            const prevY = yRange[0] + (iy - 1) * yStep;
            const prevX = (-b * prevY - c) / a;
            if (prevX >= xRange[0] && prevX <= xRange[1]) {
              vertices.push(prevX, prevY, zRange[0], x, y, zRange[0]);
              vertices.push(prevX, prevY, zRange[1], x, y, zRange[1]);
            }
          }
        }
      }
    } else if (boundaryFunction) {
      // For 3D inequalities - create a wireframe grid
      const gridStep = Math.floor(lineResolution / 10);

      // Lines along x-axis
      for (let iy = 0; iy <= lineResolution; iy += gridStep) {
        const y = yRange[0] + iy * yStep;
        for (let ix = 1; ix <= lineResolution; ix++) {
          const x = xRange[0] + ix * xStep;
          const prevX = xRange[0] + (ix - 1) * xStep;
          const z = boundaryFunction(x, y);
          const prevZ = boundaryFunction(prevX, y);

          if (
            z >= zRange[0] &&
            z <= zRange[1] &&
            prevZ >= zRange[0] &&
            prevZ <= zRange[1]
          ) {
            vertices.push(prevX, y, prevZ, x, y, z);
          }
        }
      }

      // Lines along y-axis
      for (let ix = 0; ix <= lineResolution; ix += gridStep) {
        const x = xRange[0] + ix * xStep;
        for (let iy = 1; iy <= lineResolution; iy++) {
          const y = yRange[0] + iy * yStep;
          const prevY = yRange[0] + (iy - 1) * yStep;
          const z = boundaryFunction(x, y);
          const prevZ = boundaryFunction(x, prevY);

          if (
            z >= zRange[0] &&
            z <= zRange[1] &&
            prevZ >= zRange[0] &&
            prevZ <= zRange[1]
          ) {
            vertices.push(x, prevY, prevZ, x, y, z);
          }
        }
      }
    }

    if (vertices.length === 0) {
      return undefined;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3)
    );
    return geom;
  }, [
    showBoundary,
    adaptiveResolution,
    boundaryFunction,
    boundaryLine2D,
    is2D,
    xRange,
    yRange,
    zRange,
  ]);

  // Default boundary color is the same as the region color but more opaque
  const finalBoundaryColor = boundaryColor || color;

  // Use frustum culling
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.frustumCulled = true;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Render the shaded region */}
      <mesh geometry={geometry} material={material} frustumCulled />

      {/* Render the boundary as one lineSegments for better performance */}
      {showBoundary && boundarySegmentsGeometry && (
        <lineSegments geometry={boundarySegmentsGeometry} frustumCulled>
          <lineBasicMaterial
            color={finalBoundaryColor}
            linewidth={boundaryLineWidth}
          />
        </lineSegments>
      )}

      {/* Render label if provided */}
      {label && (
        <Text
          position={label.position}
          color={label.color || finalBoundaryColor}
          fontSize={label.fontSize || 0.5}
          font={fontPath}
          anchorX="center"
          anchorY="middle"
          frustumCulled
        >
          {label.text}
        </Text>
      )}
    </group>
  );
}
