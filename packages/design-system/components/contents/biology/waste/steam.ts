/**
 * The coefficients n1 to n10 of the saturation-pressure equation of
 * IAPWS-IF97 (equation 30, region 4), the industrial standard for the
 * properties of water and steam.
 *
 * @see https://iapws.org/documents/release/IF97-Rev.download (IAPWS R7-97(2012), section 8.1, table 34)
 */
const SATURATION = [
  0.116_705_214_527_67e4, -0.724_213_167_032_06e6, -0.170_738_469_400_92e2,
  0.120_208_247_024_7e5, -0.323_255_503_223_33e7, 0.149_151_086_135_3e2,
  -0.482_326_573_615_91e4, 0.405_113_405_420_57e6, -0.238_555_575_678_49,
  0.650_175_348_447_98e3,
] as const;

/** Kelvin at 0 °C, by the definition of the Celsius scale (SI Brochure, 9th edition, section 2.3.1). */
export const KELVIN = 273.15;

/**
 * The standard atmosphere in kilopascals (101 325 Pa, defined by the 10th
 * CGPM, 1954, and used by ISO 2533). A pressure gauge reads the pressure
 * above it, so an open autoclave reads zero.
 */
export const ATMOSPHERE = 101.325;

/**
 * The room the station stands in: 25 °C, the IUPAC standard ambient
 * temperature (SATP, 298.15 K), and close to a Malaysian classroom.
 */
export const ROOM = 25;

/**
 * The sterilising hold of an autoclave: saturated steam at 121 °C for at
 * least 15 minutes once the whole load has reached that temperature. A full,
 * tightly packed waste bag needs longer, because steam takes time to reach
 * its middle.
 *
 * @see https://tbksp.who.int/en/node/1104 (WHO TB knowledge sharing platform, 6.3 Autoclaves: all air replaced by steam, and 121 °C)
 * @see https://ehs.wisc.edu/labs-research/biological-safety/autoclaves/ (UW-Madison: at least 121 °C for 15 to 20 min, longer for waste)
 */
export const STERILISE = { celsius: 121, minutes: 15 } as const;

/**
 * The dial of the autoclave's pressure gauge: its full scale in kilopascals
 * above the atmosphere, and how far its needle sweeps from zero to full
 * scale, in radians. A drawing choice, not a fact of the instrument.
 */
export const DIAL = { full: 200, sweep: Math.PI * 1.5 } as const;

/**
 * The pressure of saturated steam at `kelvin`, in kilopascals, from the
 * IAPWS-IF97 saturation-pressure equation (valid from 273.15 K to the
 * critical point, 647.096 K). At 373.12 K it is one atmosphere, which is why
 * water boils at 100 °C in an open pan; at 394.15 K (121 °C) it is about
 * 205 kPa.
 */
export function saturationPressure(kelvin: number) {
  const [n1, n2, n3, n4, n5, n6, n7, n8, n9, n10] = SATURATION;
  const theta = kelvin + n9 / (kelvin - n10);
  const a = theta * theta + n1 * theta + n2;
  const b = n3 * theta * theta + n4 * theta + n5;
  const c = n6 * theta * theta + n7 * theta + n8;
  const megapascals = ((2 * c) / (-b + Math.sqrt(b * b - 4 * a * c))) ** 4;
  return megapascals * 1000;
}

/**
 * What the autoclave's gauge reads at `celsius` once its air has been driven
 * out and only steam fills the sealed chamber: the saturation pressure above
 * the atmosphere, in kilopascals. Below 100 °C the vent is still open and the
 * gauge reads zero. At 121 °C it reads about 104 kPa, the "15 psi" printed on
 * many autoclaves.
 */
export function gaugePressure(celsius: number) {
  return Math.max(0, saturationPressure(celsius + KELVIN) - ATMOSPHERE);
}

/** The turn of the gauge's needle from its zero mark for `kilopascals`, held at full scale beyond it. */
export function needleAngle(kilopascals: number) {
  return (Math.min(kilopascals, DIAL.full) / DIAL.full) * DIAL.sweep;
}

/**
 * The cycle of the autoclave, as shares of its run: it heats the water in its
 * base to boiling, then steam drives the air out through the open vent, then
 * with the vent closed the steam's pressure, and with it the temperature,
 * climbs to the sterilising hold.
 */
const CYCLE = { boil: 0.3, vent: 0.5 } as const;

/**
 * The chamber's temperature `share` of the way through the cycle, in degrees
 * Celsius: from the room to boiling, at boiling while the air is vented, and
 * from boiling to the sterilising temperature once the vent is shut, slowing
 * as it nears it.
 */
export function celsiusAt(share: number) {
  const clamped = Math.min(1, Math.max(0, share));
  if (clamped <= CYCLE.boil) {
    return ROOM + ((100 - ROOM) * clamped) / CYCLE.boil;
  }
  if (clamped <= CYCLE.vent) {
    return 100;
  }
  const rise = (clamped - CYCLE.vent) / (1 - CYCLE.vent);
  return 100 + (STERILISE.celsius - 100) * (1 - (1 - rise) ** 2);
}

/** Whether steam is streaming from the open vent `share` of the way through the cycle, carrying the air out. */
export function isVenting(share: number) {
  return share > CYCLE.boil && share <= CYCLE.vent;
}
