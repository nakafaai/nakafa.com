import { InlineMath } from "react-katex";

export function ReadingRoomProblem() {
  return (
    <div className="my-6 flex justify-center">
      <div className="relative w-full max-w-md">
        {/* Main container - Classroom */}
        <div className="relative aspect-[3/2] w-full border bg-card shadow-sm">
          {/* Top left corner square */}
          <div className="absolute top-0 left-0 aspect-square w-[12.5%] border-r border-b bg-blue-400" />

          {/* Top right corner square */}
          <div className="absolute top-0 right-0 aspect-square w-[12.5%] border-b border-l bg-green-400" />

          {/* Bottom left corner square */}
          <div className="absolute bottom-0 left-0 aspect-square w-[12.5%] border-t border-r bg-red-400" />

          {/* Bottom right corner square */}
          <div className="absolute right-0 bottom-0 aspect-square w-[12.5%] border-t border-l bg-orange-400" />

          {/* Red dots at corners */}
          <div className="-translate-x-1 -translate-y-1 absolute top-0 left-0 size-2 transform rounded-full bg-border" />
          <div className="-translate-y-1 absolute top-0 right-0 size-2 translate-x-1 transform rounded-full bg-border" />
          <div className="-translate-x-1 absolute bottom-0 left-0 size-2 translate-y-1 transform rounded-full bg-border" />
          <div className="absolute right-0 bottom-0 size-2 translate-x-1 translate-y-1 transform rounded-full bg-border" />

          {/* Dimension labels */}
          <div className="-translate-x-1/2 -translate-y-2 absolute bottom-0 left-1/2 transform text-center">
            <span>6 m</span>
          </div>
          <div className="-translate-y-1/2 -right-1 -translate-x-4 absolute top-1/2 transform text-center">
            <span>4 m</span>
          </div>

          {/* "x" labels - Positioned to match the reference image */}
          {/* Top left corner labels */}
          <div className="absolute top-[6%] left-[14.5%]">
            <InlineMath math="x" />
          </div>
          <div className="absolute top-[18.5%] left-[6%]">
            <InlineMath math="x" />
          </div>

          {/* Top right corner labels */}
          <div className="absolute top-[6%] right-[14.5%]">
            <InlineMath math="x" />
          </div>
          <div className="absolute top-[18.5%] right-[6%]">
            <InlineMath math="x" />
          </div>

          {/* Bottom left corner labels */}
          <div className="absolute bottom-[6%] left-[14.5%]">
            <InlineMath math="x" />
          </div>
          <div className="absolute bottom-[18.5%] left-[6%]">
            <InlineMath math="x" />
          </div>

          {/* Bottom right corner labels */}
          <div className="absolute right-[14.5%] bottom-[6%]">
            <InlineMath math="x" />
          </div>
          <div className="absolute right-[6%] bottom-[18.5%]">
            <InlineMath math="x" />
          </div>
        </div>
      </div>
    </div>
  );
}
