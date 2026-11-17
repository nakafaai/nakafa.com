/**
 * Forces and motion for the mechanics labs. Momentum is conserved in a
 * collision or an explosion, kinetic energy only in an elastic collision.
 * A net force gives an acceleration a = F / m, and a body slowing at a
 * steady rate from u stops after u² / 2a. Springs in series each carry the
 * whole load, while springs side by side share it.
 */

/** A bullet of mass `bullet` kg at `speed` embeds in a block of mass `block` kg, which then slides against `friction` N. */
export function embedAndSlide(collision: {
  readonly block: number;
  readonly bullet: number;
  readonly friction: number;
  readonly speed: number;
}) {
  const mass = collision.block + collision.bullet;
  const velocity = (collision.bullet * collision.speed) / mass;
  const deceleration = collision.friction / mass;
  return {
    deceleration,
    distance: velocity ** 2 / (2 * deceleration),
    lostEnergy:
      0.5 * collision.bullet * collision.speed ** 2 -
      0.5 * mass * velocity ** 2,
    time: velocity / deceleration,
    velocity,
  };
}

/**
 * Two balls leave a cliff top `height` m above the sea: A thrown straight up
 * at `speed`, B dropped from rest `delay` s later. When each reaches the sea,
 * counted from A's throw.
 */
export function cliffDrop(throwBall: {
  readonly delay: number;
  readonly gravity: number;
  readonly height: number;
  readonly speed: number;
}) {
  const { delay, gravity, height, speed } = throwBall;
  const first =
    (speed + Math.sqrt(speed ** 2 + 2 * gravity * height)) / gravity;
  const second = delay + Math.sqrt((2 * height) / gravity);
  return { first, peak: height + speed ** 2 / (2 * gravity), second };
}

/** The height of ball A above the sea `time` s after it was thrown. */
export function heightOfThrown(
  throwBall: {
    readonly gravity: number;
    readonly height: number;
    readonly speed: number;
  },
  time: number
) {
  return (
    throwBall.height +
    throwBall.speed * time -
    0.5 * throwBall.gravity * time ** 2
  );
}

/** A rifle of mass `rifle` kg fires a bullet of mass `bullet` kg at `speed`; the shoulder stops the recoil over `stop` m. */
export function recoil(shot: {
  readonly bullet: number;
  readonly rifle: number;
  readonly speed: number;
  readonly stop: number;
}) {
  const momentum = shot.bullet * shot.speed;
  const velocity = momentum / shot.rifle;
  const energy = 0.5 * shot.rifle * velocity ** 2;
  return { energy, force: energy / shot.stop, momentum, velocity };
}

/** Two blocks joined by a string, pulled from the front by `pull` N, with `friction` N acting on the back block only. */
export function connectedBlocks(blocks: {
  readonly back: number;
  readonly friction: number;
  readonly front: number;
  readonly pull: number;
}) {
  const acceleration =
    (blocks.pull - blocks.friction) / (blocks.back + blocks.front);
  return {
    acceleration,
    tension: blocks.back * acceleration + blocks.friction,
  };
}

/** A person of mass `mass` kg on scales in a lift reading `reading` N: the lift's acceleration, upward positive. */
export function liftAcceleration(
  mass: number,
  reading: number,
  gravity: number
) {
  return (reading - mass * gravity) / mass;
}

/** A block sliding up a plane at `angle` degrees from `speed`, with `friction` N against it: its deceleration and how far it rises. */
export function slideUp(block: {
  readonly angle: number;
  readonly friction: number;
  readonly gravity: number;
  readonly mass: number;
  readonly speed: number;
}) {
  const along =
    block.mass * block.gravity * Math.sin((block.angle * Math.PI) / 180);
  const deceleration = (along + block.friction) / block.mass;
  return {
    along,
    deceleration,
    distance: block.speed ** 2 / (2 * deceleration),
  };
}

/** One spring above two side by side, all of stiffness `stiffness` N m⁻¹, carrying `load` N: each extension and the total, in metres. */
export function springChain(stiffness: number, load: number) {
  const top = load / stiffness;
  const pair = load / 2 / stiffness;
  return { pair, top, total: top + pair };
}
