import { Schema } from "effect";
import { useEffect, useRef } from "react";

const MousePositionSchema = Schema.Struct({
  x: Schema.Finite,
  y: Schema.Finite,
});

type MousePosition = typeof MousePositionSchema.Type;

export function useMousePosition() {
  const mousePosition = useRef<MousePosition>({
    x: 0,
    y: 0,
  });

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      mousePosition.current = { x: event.clientX, y: event.clientY };
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return mousePosition;
}
