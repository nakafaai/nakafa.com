"use client";

import { useInViewport, useMergedRef, useReducedMotion } from "@mantine/hooks";
import {
  createDrive,
  type Drive,
} from "@repo/design-system/components/pool/drive";
import {
  type PoolMember,
  poolMembers,
} from "@repo/design-system/components/pool/member";
import { Animal } from "@repo/design-system/components/ui/animal";
import { Thing } from "@repo/design-system/components/ui/thing";
import { cva } from "class-variance-authority";
import { Array as Arr } from "effect";
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

/**
 * The box of one member. An animal fills a circle, as it does in an avatar, and
 * a thing keeps its own outline.
 */
const memberVariants = cva("absolute top-0 left-0", {
  variants: {
    kind: { animal: "overflow-hidden rounded-full", thing: "" },
  },
});

/** One member of the pool, drawn once. The frame loop writes its place, not React. */
function Member({ member }: { member: PoolMember }) {
  return (
    <div className={memberVariants({ kind: member.kind })}>
      {member.kind === "animal" ? (
        <Animal mascot={member.mascot} />
      ) : (
        <Thing className="size-full" name={member.name} />
      )}
    </div>
  );
}

/**
 * The animal pool of the sign-in page: animals and things that pile up, and move
 * away from the pointer. The animals cover about half of the box, so the box sets
 * how many of them React draws. With motion, the animals fall into the box from above
 * it, and the box fades in at once. Each frame writes only where each member is and
 * how it leans, straight onto its element. The loop sleeps while the pile rests, and
 * wakes for the pointer, a hop, or a view of the box. A resize settles a new pile
 * first, and the loop stays asleep until it is done. With reduced motion the pile
 * settles before the box shows it, and there is no loop, no pointer, and no fade.
 */
export function Pool() {
  const calm = useReducedMotion(undefined, { getInitialValueInEffect: false });
  const { inViewport, ref: watch } = useInViewport<HTMLDivElement>();
  const box = useRef<HTMLDivElement>(null);
  const place = useMergedRef(box, watch);
  const drive = useRef<Drive | undefined>(undefined);
  const [animals, setAnimals] = useState(0);
  const viewing = useEffectEvent(() => inViewport);

  useEffect(() => {
    if (!box.current) {
      return;
    }
    const created = createDrive(box.current, calm, setAnimals);
    drive.current = created;
    created.setVisible(viewing());
    return () => {
      drive.current = undefined;
      created.destroy();
    };
  }, [calm]);

  // After each render React may have drawn a new count of members, so the drive gives every member its size and place before the paint.
  useLayoutEffect(() => {
    drive.current?.sync();
  });

  useEffect(() => {
    drive.current?.setVisible(inViewport);
  }, [inViewport]);

  // Nothing is drawn until the box has been measured: a count of zero stands for that.
  const members = animals === 0 ? [] : poolMembers(animals);

  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden opacity-0 transition-opacity data-[shown=true]:opacity-100 motion-reduce:transition-none"
      data-slot="pool"
      ref={place}
    >
      {Arr.map(members, (member) => (
        <Member key={member.key} member={member} />
      ))}
    </div>
  );
}
