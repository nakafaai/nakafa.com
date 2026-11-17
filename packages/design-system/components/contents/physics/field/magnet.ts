/**
 * Electromagnetism for the field labs. A transformer's voltages follow its
 * turns, V_p / V_s = N_p / N_s, and a real one loses part of its input power
 * as heat. A wire carrying current I across a field B feels F = B I l, at
 * right angles to both, along I × B as Fleming's left-hand rule finds it. A
 * magnet falling through a metal pipe drives eddy currents whose field, by
 * Lenz's law, opposes its motion with a drag that grows with its speed.
 */

/** A vector in space: x east, y north, z up. */
type Vector = readonly [number, number, number];

/** A step-down or step-up transformer: its turns ratio and the primary and secondary currents. */
export function transformer(coils: {
  readonly efficiency: number;
  readonly output: number;
  readonly primary: number;
  readonly secondary: number;
}) {
  const input = coils.output / coils.efficiency;
  return {
    input,
    lost: input - coils.output,
    primaryCurrent: input / coils.primary,
    ratio: coils.primary / coils.secondary,
    secondaryCurrent: coils.output / coils.secondary,
  };
}

/** The cross product a × b. */
function cross(a: Vector, b: Vector): Vector {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/**
 * The current that holds a horizontal wire of mass `mass` kg and length
 * `length` m up in a field `field` T, so that B I l equals its weight, and
 * the direction it must flow: along B × F for an upward force F, the
 * direction for which I × B points up.
 */
export function balancingCurrent(
  wire: {
    readonly field: number;
    readonly length: number;
    readonly mass: number;
  },
  gravity: number,
  fieldDirection: Vector
) {
  const direction = cross(fieldDirection, [0, 0, 1]);
  return {
    current: (wire.mass * gravity) / (wire.field * wire.length),
    direction,
  };
}

/**
 * How a magnet falls through a vertical pipe with eddy-current drag k v per
 * unit mass, from rest: its speed approaches the terminal speed g / k, and
 * its distance after `time` seconds is v_t t − (v_t² / g)(1 − e^(−g t / v_t)).
 * With no drag it falls freely, ½ g t².
 */
export function fallThrough(drag: number, gravity: number, time: number) {
  if (drag === 0) {
    return { distance: 0.5 * gravity * time ** 2, speed: gravity * time };
  }
  const terminal = gravity / drag;
  const decay = Math.exp(-drag * time);
  return {
    distance: terminal * time - (terminal / drag) * (1 - decay),
    speed: terminal * (1 - decay),
  };
}

/** The time a magnet takes to fall `length` metres with drag `drag`, found by bisection on the distance it has fallen. */
export function fallTime(drag: number, gravity: number, length: number) {
  let low = 0;
  let high = 1;
  while (fallThrough(drag, gravity, high).distance < length) {
    high *= 2;
  }
  for (let step = 0; step < 60; step += 1) {
    const middle = (low + high) / 2;
    if (fallThrough(drag, gravity, middle).distance < length) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return (low + high) / 2;
}
