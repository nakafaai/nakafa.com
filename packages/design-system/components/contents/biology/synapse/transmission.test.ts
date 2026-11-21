// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  bindingAt,
  CYCLE,
  clearance,
  DELAY,
  IMPULSES,
  interval,
  openAt,
  PER_VESICLE,
  phaseOf,
  potentialAt,
  REST,
  RUN,
  receptorsAt,
  released,
  settledAt,
  shownAt,
  synapseTime,
  THRESHOLD,
  transmitterAt,
  treatmentOf,
  VESICLES,
} from "@repo/design-system/components/contents/biology/synapse/transmission";
import { Array as Arr } from "effect";

describe("acetylcholine in the cleft", () => {
  it("releases two vesicles of 10,000 molecules half a millisecond after each impulse", () => {
    expect(released("none")).toBe(VESICLES * PER_VESICLE);
    expect(released("none")).toBe(20_000);
    expect(transmitterAt(DELAY - 0.01, 10, "none")).toBe(0);
    expect(transmitterAt(DELAY, 10, "none")).toBe(20_000);
  });

  it("is split with a time constant of a millisecond, 3.3 times longer once the enzyme is blocked", () => {
    expect(clearance("none")).toBe(1);
    expect(transmitterAt(DELAY + 1, 10, "none")).toBeCloseTo(
      20_000 / Math.E,
      6
    );
    expect(clearance("organophosphate")).toBeCloseTo(3.3, 12);
    expect(transmitterAt(DELAY + 3.3, 10, "organophosphate")).toBeCloseTo(
      20_000 / Math.E,
      6
    );
  });

  it("is never released under botulinum toxin", () => {
    expect(released("botulinum")).toBe(0);
    expect(transmitterAt(DELAY + 0.2, 50, "botulinum")).toBe(0);
  });

  it("adds each impulse's release to what is left of the last", () => {
    const gap = interval(50);
    expect(gap).toBe(20);
    expect(transmitterAt(gap + DELAY, 50, "organophosphate")).toBeCloseTo(
      20_000 * (1 + Math.exp(-gap / 3.3)),
      6
    );
  });
});

describe("the receptors", () => {
  it("open a quarter when acetylcholine holds half of the binding sites", () => {
    expect(bindingAt(20_000, "none").acetylcholine).toBe(0.5);
    expect(openAt(20_000, "none")).toBe(0.25);
    expect(openAt(0, "none")).toBe(0);
  });

  it("stay shut under curare, which takes the sites from acetylcholine", () => {
    const binding = bindingAt(20_000, "curare");
    expect(binding.curare).toBeGreaterThan(0.9);
    expect(openAt(20_000, "curare")).toBeLessThan(0.003);
  });

  it("open under nicotine without any acetylcholine", () => {
    expect(bindingAt(0, "nicotine").nicotine).toBeCloseTo(0.3 / 1.3, 12);
    expect(openAt(0, "nicotine")).toBeGreaterThan(0.01);
  });
});

describe("the postsynaptic potential", () => {
  it("rests at -70 mV and settles towards 0 mV as more receptors stay open", () => {
    expect(settledAt(0)).toBe(REST);
    expect(settledAt(1)).toBeCloseTo(-70 / 31, 12);
    expect(potentialAt(0, 10, "none")).toEqual({
      fired: false,
      potential: REST,
    });
  });

  it("rises about 11 mV after one impulse, below the 15 mV to threshold", () => {
    const peak = Math.max(
      ...Arr.map(
        [2, 3, 4, 5, 6],
        (time) => potentialAt(time, 1, "none").potential
      )
    );
    expect(peak - REST).toBeGreaterThan(10);
    expect(peak).toBeLessThan(THRESHOLD);
    expect(potentialAt(999, 1, "none").potential).toBeCloseTo(REST, 6);
  });

  it("sums impulses at 30 a second to threshold, but not at 20 a second", () => {
    expect(potentialAt(IMPULSES * interval(30), 30, "none").fired).toBe(true);
    expect(potentialAt(IMPULSES * interval(20), 20, "none").fired).toBe(false);
  });

  it("fires on every impulse under nicotine or an organophosphate, and never under curare or botulinum toxin", () => {
    expect(potentialAt(0.01, 1, "nicotine").fired).toBe(true);
    expect(potentialAt(10, 1, "organophosphate").fired).toBe(true);
    expect(potentialAt(IMPULSES * 20, 50, "curare").fired).toBe(false);
    expect(potentialAt(IMPULSES * 20, 50, "botulinum")).toEqual({
      fired: false,
      potential: REST,
    });
  });
});

describe("the playback", () => {
  it("plays each impulse in 4.4 s, slowing the release and passing the rest of the interval quickly", () => {
    expect(RUN).toBeCloseTo(CYCLE * IMPULSES, 12);
    expect(synapseTime(0, 10)).toBe(0);
    expect(synapseTime(1.6, 10)).toBeCloseTo(DELAY, 12);
    expect(synapseTime(3.6, 10)).toBeCloseTo(3, 12);
    expect(synapseTime(CYCLE, 10)).toBeCloseTo(100, 12);
    expect(synapseTime(CYCLE * 2 + 1.2, 10)).toBeCloseTo(200.45, 12);
    expect(synapseTime(RUN, 10)).toBeCloseTo(IMPULSES * 100, 12);
  });

  it("reads the playback the other way", () => {
    expect(shownAt(0, 10)).toBe(0);
    expect(shownAt(-1, 10)).toBe(0);
    expect(shownAt(DELAY, 10)).toBeCloseTo(1.6, 12);
    expect(shownAt(3, 10)).toBeCloseTo(3.6, 12);
    expect(shownAt(51.5, 10)).toBeCloseTo(4, 12);
    expect(shownAt(500, 10)).toBe(CYCLE);
  });

  it("names the impulse and the time since it arrived", () => {
    expect(phaseOf(0)).toEqual({ index: 0, within: 0 });
    expect(phaseOf(CYCLE * 3 + 1)).toEqual({ index: 3, within: 1 });
    expect(phaseOf(RUN).index).toBe(IMPULSES - 1);
  });

  it("reads the drug toggle", () => {
    expect(treatmentOf("curare")).toBe("curare");
    expect(treatmentOf("nicotine")).toBe("nicotine");
    expect(treatmentOf("organophosphate")).toBe("organophosphate");
    expect(treatmentOf("botulinum")).toBe("botulinum");
    expect(treatmentOf("none")).toBe("none");
  });
});

describe("the receptors the lab draws", () => {
  it("opens a quarter of them with acetylcholine on both sites, the rest holding one or none", () => {
    const drawn = receptorsAt(20_000, "none", 8);
    const open = Arr.filter(drawn, (receptor) => receptor.open);
    expect(open.length).toBe(2);
    expect(
      Arr.every(
        open,
        ({ sites }) =>
          sites[0] === "acetylcholine" && sites[1] === "acetylcholine"
      )
    ).toBe(true);
    const held = Arr.flatMap(drawn, ({ sites }) => sites);
    expect(
      Arr.filter(held, (ligand) => ligand === "acetylcholine").length
    ).toBe(8);
    expect(
      Arr.some(
        drawn,
        (receptor) => !receptor.open && receptor.sites[0] === "acetylcholine"
      )
    ).toBe(true);
  });

  it("leaves every site empty and every channel shut without acetylcholine", () => {
    expect(receptorsAt(0, "none", 4)).toEqual(
      Arr.makeBy(4, () => ({ open: false, sites: ["empty", "empty"] }))
    );
  });

  it("fills nearly every site with curare and opens none", () => {
    const drawn = receptorsAt(20_000, "curare", 8);
    const held = Arr.flatMap(drawn, ({ sites }) => sites);
    expect(
      Arr.filter(held, (ligand) => ligand === "curare").length
    ).toBeGreaterThanOrEqual(14);
    expect(Arr.some(drawn, (receptor) => receptor.open)).toBe(false);
  });

  it("holds nicotine on the first sites and opens their receptor with no acetylcholine", () => {
    const drawn = receptorsAt(0, "nicotine", 12);
    expect(drawn[0]).toEqual({ open: true, sites: ["nicotine", "nicotine"] });
    expect(drawn[1]?.open).toBe(false);
    const busy = receptorsAt(20_000, "nicotine", 12);
    expect(busy[0]?.sites[0]).toBe("nicotine");
    expect(busy[0]?.open).toBe(true);
  });
});
