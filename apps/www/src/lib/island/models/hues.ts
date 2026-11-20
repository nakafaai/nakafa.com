import { rgb } from "@/lib/island/models/parts";

/**
 * The art colors of everything a learner builds and of the wild trees (ADR
 * 0050, W2): warm and saturated, one flat color a face, a few tones a
 * material so neighbouring parts step in tone.
 */
export const HUES = {
  bamboo: rgb(0xc2_b2_66),
  bark: rgb(0x5f_42_30),
  blue: rgb(0x46_75_b8),
  brick: rgb(0xa8_40_2e),
  cream: rgb(0xf3_e3_c2),
  dark: rgb(0x3d_32_2b),
  ember: rgb(0xf0_8a_33),
  fir: rgb(0x3a_81_60),
  flame: rgb(0xe5_55_2d),
  glass: rgb(0x86_b4_d0),
  glow: rgb(0xff_e2_a0),
  iron: rgb(0x4a_4f_55),
  leaf: rgb(0x4f_9a_3c),
  lime: rgb(0x6f_b3_46),
  moss: rgb(0x3a_7d_40),
  navy: rgb(0x35_58_9a),
  oak: rgb(0xc7_9a_66),
  pine: rgb(0x2c_6b_50),
  pink: rgb(0xee_84_a8),
  red: rgb(0xc9_52_3b),
  rope: rgb(0xcd_b9_8a),
  slate: rgb(0x83_83_7f),
  soil: rgb(0x6d_4a_32),
  sprout: rgb(0x8c_c2_4f),
  stone: rgb(0x9d_9c_96),
  straw: rgb(0xb3_8c_3d),
  teal: rgb(0x39_a0_9a),
  thatch: rgb(0xcf_a9_54),
  trunk: rgb(0x7a_52_38),
  violet: rgb(0x94_78_d8),
  wall: rgb(0xf4_ea_d3),
  walnut: rgb(0x86_59_2f),
  water: rgb(0x2f_6f_9a),
  white: rgb(0xfb_f5_e9),
  wood: rgb(0xa9_76_4a),
  yellow: rgb(0xf7_c5_2f),
} as const;
