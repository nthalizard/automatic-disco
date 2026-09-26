/*  SHAFT ALIGNMENT — Gap & Offset (laser) method
    Movable machine (MTBM) relative to stationary machine, at the coupling-center plane.

    All values imperial: offsets/gaps in thou, distances in inches, slopes in thou/in.
    Conventions:
      Vertical    +offset = movable HIGH ; +slope = OPEN AT BOTTOM
      Horizontal  +offset = movable RIGHT; +slope = OPEN AT LEFT
      slope = gap / coupling dia ; +foot move = ADD shims / toward +H
    `hflip` reverses the horizontal convention (viewpoint flipped). */

export interface PlaneReading { offset: number; gap: number }
export interface Readings { vertical: PlaneReading; horizontal: PlaneReading }

export interface AlignmentInput {
  /** coupling diameter, in */
  couplingDia: number;
  /** coupling center → front foot, in */
  frontFoot: number;
  /** coupling center → back foot, in */
  backFoot: number;
  measured: Readings;
  target: Readings;
  hflip: boolean;
}

export interface AlignmentResult {
  l1: number; l2: number;
  rOffV: number; rSlopeV: number; rOffH: number; rSlopeH: number;
  rGapV: number; rGapH: number;
  feet: { frontV: number; backV: number; frontH: number; backH: number };
}

export const ZERO_READINGS: Readings = {
  vertical: { offset: 0, gap: 0 },
  horizontal: { offset: 0, gap: 0 },
};

/** Foot move needed to bring the movable centerline onto target at distance x from the coupling. */
export const footMove = (offset: number, slope: number, x: number) => -(offset + slope * x);

export function computeAlignment(inp: AlignmentInput): AlignmentResult {
  const d = Math.max(inp.couplingDia, 1e-6);
  const l1 = inp.frontFoot, l2 = inp.backFoot;
  const hf = inp.hflip ? -1 : 1;
  const { measured: m, target: t } = inp;

  const rOffV = m.vertical.offset - t.vertical.offset;
  const rSlopeV = m.vertical.gap / d - t.vertical.gap / d;
  const rOffH = hf * m.horizontal.offset - hf * t.horizontal.offset;
  const rSlopeH = hf * (m.horizontal.gap / d) - hf * (t.horizontal.gap / d);

  return {
    l1, l2, rOffV, rSlopeV, rOffH, rSlopeH,
    rGapV: rSlopeV * d, rGapH: rSlopeH * d,
    feet: {
      frontV: footMove(rOffV, rSlopeV, l1), backV: footMove(rOffV, rSlopeV, l2),
      frontH: footMove(rOffH, rSlopeH, l1), backH: footMove(rOffH, rSlopeH, l2),
    },
  };
}
