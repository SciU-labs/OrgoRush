import {
  buildOpenChainSkeletalPositions,
} from "./skeletal-layout.ts";
import { findOrderedSimpleMonocycle } from "./simple-cycle.ts";
import {
  calculateSemiDevelopedLayout,
  type SemiDevelopedStereoBond,
  type SemiDevelopedPoint,
} from "./semi-developed-layout.ts";
import { inspectDoubleBondStereochemistry, type ReadonlyStereoMolecule } from "./double-bond-stereochemistry.ts";
import type { ManualDisplayPlacement } from "./manual-display-direction.ts";
import type { ViewMode } from "./view-mode.ts";

type SkeletalPoint = { x: number; y: number };

type LayoutAtom = ReadonlyStereoMolecule["atoms"][number];

type LayoutMolecule = ReadonlyStereoMolecule & {
  isMirrored?: boolean;
  stableSkeletalOrientation?: boolean;
  manualDisplayDirections?: readonly ManualDisplayPlacement[];
  incrementalLayout?: IncrementalLayout;
};

export type IncrementalLayout = {
  signature: string;
  skeletal: Array<{ id: number; x: number; y: number }>;
  semiDeveloped: Array<{ id: number; x: number; y: number }>;
  adjustments: Array<{ view: "skeletal" | "semi-developed"; atomId: number; turnSteps: number; scale: number; relocatedAtomId?: number }>;
};

function layoutSignature(molecule: LayoutMolecule) {
  return JSON.stringify([molecule.atoms, molecule.bonds, molecule.rings ?? [],
    molecule.manualDisplayDirections ?? [], Boolean(molecule.isMirrored)]);
}

const BOND_LENGTH = 130;
const X_SCALE = 130;
const Y_SCALE = 106;
const TURN_ANGLE = Math.PI / 3;

function pointAt(origin: SkeletalPoint, angle: number): SkeletalPoint {
  return {
    x: origin.x + Math.cos(angle) * BOND_LENGTH,
    y: origin.y + Math.sin(angle) * BOND_LENGTH,
  };
}

function semiDevelopedStereoBonds(molecule: LayoutMolecule): SemiDevelopedStereoBond[] {
  return molecule.bonds.flatMap((bond) => {
    const [left, right, order = 1] = bond;
    if (order !== 2 || bond[3] !== true) return [];
    const inspection = inspectDoubleBondStereochemistry(molecule, left, right);
    return inspection.stereogenic && inspection.configuration
      ? [{ leftAtomId: left, rightAtomId: right, configuration: inspection.configuration }]
      : [];
  });
}

function distanceToSegment(
  point: SkeletalPoint,
  start: SkeletalPoint,
  end: SkeletalPoint,
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
  const projection = Math.max(0, Math.min(1,
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
  ));
  return Math.hypot(
    point.x - (start.x + projection * dx),
    point.y - (start.y + projection * dy),
  );
}

function segmentDistance(
  firstStart: SkeletalPoint,
  firstEnd: SkeletalPoint,
  secondStart: SkeletalPoint,
  secondEnd: SkeletalPoint,
) {
  const cross = (origin: SkeletalPoint, left: SkeletalPoint, right: SkeletalPoint) =>
    (left.x - origin.x) * (right.y - origin.y)
    - (left.y - origin.y) * (right.x - origin.x);
  const firstSideA = cross(firstStart, firstEnd, secondStart);
  const firstSideB = cross(firstStart, firstEnd, secondEnd);
  const secondSideA = cross(secondStart, secondEnd, firstStart);
  const secondSideB = cross(secondStart, secondEnd, firstEnd);
  if (firstSideA * firstSideB <= 0 && secondSideA * secondSideB <= 0) return 0;
  return Math.min(
    distanceToSegment(firstStart, secondStart, secondEnd),
    distanceToSegment(firstEnd, secondStart, secondEnd),
    distanceToSegment(secondStart, firstStart, firstEnd),
    distanceToSegment(secondEnd, firstStart, firstEnd),
  );
}

function incrementalSegmentDistance(a: SkeletalPoint, b: SkeletalPoint, c: SkeletalPoint, d: SkeletalPoint) {
  // The general renderer's intersection shortcut treats disjoint collinear
  // segments as crossing. A growing straight backbone needs the true distance.
  const separated = Math.max(a.x,b.x) < Math.min(c.x,d.x) - 1e-8
    || Math.max(c.x,d.x) < Math.min(a.x,b.x) - 1e-8
    || Math.max(a.y,b.y) < Math.min(c.y,d.y) - 1e-8
    || Math.max(c.y,d.y) < Math.min(a.y,b.y) - 1e-8;
  return separated ? Math.min(distanceToSegment(a,c,d), distanceToSegment(b,c,d),
    distanceToSegment(c,a,b), distanceToSegment(d,a,b)) : segmentDistance(a,b,c,d);
}

function candidateClearance(
  candidate: SkeletalPoint,
  origin: SkeletalPoint,
  positions: ReadonlyMap<number, SkeletalPoint>,
  segments: readonly [SkeletalPoint, SkeletalPoint][],
) {
  const atomClearance = Math.min(
    BOND_LENGTH * 2,
    ...[...positions.values()]
      .filter((point) => point !== origin)
      .map((point) => Math.hypot(candidate.x - point.x, candidate.y - point.y)),
  );
  const bondClearance = Math.min(
    BOND_LENGTH,
    ...segments
      .filter(([start, end]) => start !== origin && end !== origin)
      .map(([start, end]) => segmentDistance(origin, candidate, start, end)),
  );
  return Math.min(atomClearance, bondClearance * 1.35);
}

function pointInPolygon(point: SkeletalPoint, polygon: readonly SkeletalPoint[]) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    if (
      (currentPoint.y > point.y) !== (previousPoint.y > point.y)
      && point.x < (previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)
        / (previousPoint.y - currentPoint.y) + currentPoint.x
    ) inside = !inside;
  }
  return inside;
}

function attachmentCrossesRingInterior(
  origin: SkeletalPoint,
  candidate: SkeletalPoint,
  rings: readonly { atomIds: readonly number[] }[],
  positions: ReadonlyMap<number, SkeletalPoint>,
) {
  const polygons = rings.map((ring) => ring.atomIds.map((atomId) => positions.get(atomId)))
    .filter((polygon): polygon is SkeletalPoint[] => polygon.every(Boolean));
  // Sampling the full prospective bond catches both an endpoint inside a ring
  // and a bond that enters a neighbouring polygon before leaving it again.
  for (let step = 1; step <= 20; step += 1) {
    const progress = step / 20;
    const point = {
      x: origin.x + (candidate.x - origin.x) * progress,
      y: origin.y + (candidate.y - origin.y) * progress,
    };
    if (polygons.some((polygon) => pointInPolygon(point, polygon))) return true;
  }
  return false;
}

function getFusionJunctionExteriorAngle(
  atomId: number,
  rings: readonly { atomIds: readonly number[] }[],
  positions: ReadonlyMap<number, SkeletalPoint>,
) {
  const directRings = rings.filter((ring) => ring.atomIds.includes(atomId));
  if (directRings.length < 2) return null;
  const origin = positions.get(atomId);
  if (!origin) return null;
  const ringNeighborIds = new Set<number>();
  for (const ring of directRings) {
    const index = ring.atomIds.indexOf(atomId);
    ringNeighborIds.add(ring.atomIds[(index - 1 + ring.atomIds.length) % ring.atomIds.length]);
    ringNeighborIds.add(ring.atomIds[(index + 1) % ring.atomIds.length]);
  }
  const freeValenceDirection = [...ringNeighborIds].reduce((sum, neighborId) => {
    const neighbor = positions.get(neighborId);
    if (!neighbor) return sum;
    const distance = Math.hypot(origin.x - neighbor.x, origin.y - neighbor.y) || 1;
    return {
      x: sum.x + (origin.x - neighbor.x) / distance,
      y: sum.y + (origin.y - neighbor.y) / distance,
    };
  }, { x: 0, y: 0 });
  return Math.hypot(freeValenceDirection.x, freeValenceDirection.y) > 1e-8
    ? Math.atan2(freeValenceDirection.y, freeValenceDirection.x)
    : null;
}

function buildRingAwarePositions(
  molecule: LayoutMolecule,
  rings: readonly { atomIds: readonly number[]; inferred?: boolean }[],
) {
  const positions = new Map<number, SkeletalPoint>();
  const atomsById = new Map(molecule.atoms.map((atom) => [atom.id, atom]));
  const ringAtomIds = new Set(rings.flatMap((ring) => ring.atomIds));
  const adjacency = new Map<number, number[]>(molecule.atoms.map((atom) => [atom.id, []]));
  molecule.bonds.forEach(([left, right]) => {
    adjacency.get(left)?.push(right);
    adjacency.get(right)?.push(left);
  });
  adjacency.forEach((neighbors, atomId) => {
    const origin = atomsById.get(atomId);
    neighbors.sort((left, right) => {
      const leftAtom = atomsById.get(left);
      const rightAtom = atomsById.get(right);
      if (!origin || !leftAtom || !rightAtom) return 0;
      return Math.atan2(leftAtom.y - origin.y, leftAtom.x - origin.x)
        - Math.atan2(rightAtom.y - origin.y, rightAtom.x - origin.x);
    });
  });

  // Explicit editor/imported polygons retain their geometry. When an importer
  // omitted ring metadata, generate the same clean regular polygon from the
  // ordered graph cycle instead of drawing an open zigzag with one long bond.
  for (const atom of molecule.atoms) {
    const inferredRing = rings.find((ring) => ring.inferred && ring.atomIds.includes(atom.id));
    if (ringAtomIds.has(atom.id) && !inferredRing) {
      positions.set(atom.id, { x: atom.x * X_SCALE, y: atom.y * Y_SCALE });
    }
  }

  for (const ring of rings.filter((candidate) => candidate.inferred)) {
    const sourcePoints = ring.atomIds
      .map((atomId) => atomsById.get(atomId))
      .filter((atom): atom is LayoutAtom => Boolean(atom));
    if (sourcePoints.length !== ring.atomIds.length || ring.atomIds.length < 3) continue;
    const center = sourcePoints.reduce(
      (sum, atom) => ({ x: sum.x + atom.x * X_SCALE / sourcePoints.length, y: sum.y + atom.y * Y_SCALE / sourcePoints.length }),
      { x: 0, y: 0 },
    );
    const radius = BOND_LENGTH / (2 * Math.sin(Math.PI / ring.atomIds.length));
    ring.atomIds.forEach((atomId, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / ring.atomIds.length;
      positions.set(atomId, {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
      });
    });
  }

  const ringCenters = new Map<number, SkeletalPoint>();
  const unassignedRings = new Set(rings);
  while (unassignedRings.size) {
    const first = unassignedRings.values().next().value!;
    const component = [first];
    const componentAtomIds = new Set(first.atomIds);
    unassignedRings.delete(first);
    for (let index = 0; index < component.length; index++) {
      for (const candidate of [...unassignedRings]) {
        if (!candidate.atomIds.some((atomId) => componentAtomIds.has(atomId))) continue;
        component.push(candidate);
        candidate.atomIds.forEach((atomId) => componentAtomIds.add(atomId));
        unassignedRings.delete(candidate);
      }
    }
    const vertices = [...componentAtomIds].map((atomId) => positions.get(atomId)).filter(Boolean) as SkeletalPoint[];
    if (!vertices.length) continue;
    const center = vertices.reduce(
      (sum, point) => ({ x: sum.x + point.x / vertices.length, y: sum.y + point.y / vertices.length }),
      { x: 0, y: 0 },
    );
    componentAtomIds.forEach((atomId) => ringCenters.set(atomId, center));
  }

  const segments: [SkeletalPoint, SkeletalPoint][] = molecule.bonds.flatMap(([left, right]) => {
    const start = positions.get(left);
    const end = positions.get(right);
    return start && end ? [[start, end] as [SkeletalPoint, SkeletalPoint]] : [];
  });
  const visited = new Set(positions.keys());

  const placeDescendants = (
    parentId: number,
    atomId: number,
    incomingAngle: number,
    preferredTurn: 1 | -1,
  ) => {
    const origin = positions.get(atomId)!;
    const children = (adjacency.get(atomId) ?? []).filter((id) => !visited.has(id));
    children.forEach((childId, childIndex) => {
      const rawChild = atomsById.get(childId);
      const rawAtom = atomsById.get(atomId);
      const rawAngle = rawChild && rawAtom
        ? Math.atan2((rawChild.y - rawAtom.y) * Y_SCALE, (rawChild.x - rawAtom.x) * X_SCALE)
        : incomingAngle;
      const rawTurn = Math.abs(Math.atan2(
        Math.sin(rawAngle - incomingAngle),
        Math.cos(rawAngle - incomingAngle),
      ));
      const hasExplicitRawTurn = rawTurn > Math.PI / 12;
      const alternatingTurn = childIndex === 0 ? preferredTurn : (preferredTurn * -1) as 1 | -1;
      const candidates = [
        incomingAngle + alternatingTurn * TURN_ANGLE,
        incomingAngle - alternatingTurn * TURN_ANGLE,
        incomingAngle + Math.PI * 2 / 3,
        incomingAngle - Math.PI * 2 / 3,
      ];
      const ranked = candidates.map((angle, index) => {
        const point = pointAt(origin, angle);
        return {
          angle,
          index,
          point,
          clearance: candidateClearance(point, origin, positions, segments),
          rawDifference: Math.abs(Math.atan2(Math.sin(angle - rawAngle), Math.cos(angle - rawAngle))),
        };
      }).sort((left, right) => {
        if (hasExplicitRawTurn) {
          const leftSafe = left.clearance >= BOND_LENGTH * 0.55;
          const rightSafe = right.clearance >= BOND_LENGTH * 0.55;
          if (leftSafe !== rightSafe) return leftSafe ? -1 : 1;
          if (leftSafe && Math.abs(left.rawDifference - right.rawDifference) > 1e-8) {
            return left.rawDifference - right.rawDifference;
          }
        }
        return right.clearance - left.clearance
          || left.rawDifference - right.rawDifference
          || left.index - right.index;
      });
      const chosen = ranked[0];
      positions.set(childId, chosen.point);
      visited.add(childId);
      segments.push([origin, chosen.point]);
      const chosenDelta = Math.atan2(
        Math.sin(chosen.angle - incomingAngle),
        Math.cos(chosen.angle - incomingAngle),
      );
      const nextTurn: 1 | -1 = chosenDelta >= 0 ? -1 : 1;
      placeDescendants(atomId, childId, chosen.angle, nextTurn);
    });
  };

  // Start each acyclic substituent in its stored direction when that direction
  // already exits the ring (manual arrows depend on it). Imported inward
  // coordinates still fall back to the safe radial direction.
  const orderedRingAtomIds = [...ringAtomIds].sort((left, right) => {
    const leftPoint = positions.get(left);
    const rightPoint = positions.get(right);
    if (!leftPoint || !rightPoint) return 0;
    return leftPoint.x - rightPoint.x || leftPoint.y - rightPoint.y;
  });
  for (const ringAtomId of orderedRingAtomIds) {
    const ringPoint = positions.get(ringAtomId);
    const center = ringCenters.get(ringAtomId);
    if (!ringPoint || !center) continue;
    const radialAngle = Math.atan2(ringPoint.y - center.y, ringPoint.x - center.x);
    // At a fused-ring junction, the global ring-system centroid can lie on
    // the wrong face. Use the free sector between its immediate ring bonds.
    const outwardAngle = getFusionJunctionExteriorAngle(ringAtomId, rings, positions) ?? radialAngle;
    for (const childId of adjacency.get(ringAtomId) ?? []) {
      if (visited.has(childId)) continue;
      const rawRingAtom = atomsById.get(ringAtomId);
      const rawChild = atomsById.get(childId);
      const rawAngle = rawRingAtom && rawChild
        ? Math.atan2(
            (rawChild.y - rawRingAtom.y) * Y_SCALE,
            (rawChild.x - rawRingAtom.x) * X_SCALE,
          )
        : outwardAngle;
      // Preserve an importer's direction whenever the actual bond stays out of
      // every ring polygon. The local free-valence vector is only a source of
      // alternatives: at angular steroid junctions its sum can point into a
      // neighbouring ring even when the imported methyl is already exterior.
      const angleCandidates = [
        rawAngle,
        outwardAngle,
        outwardAngle + TURN_ANGLE / 2,
        outwardAngle - TURN_ANGLE / 2,
        outwardAngle + TURN_ANGLE,
        outwardAngle - TURN_ANGLE,
        outwardAngle + TURN_ANGLE * 1.5,
        outwardAngle - TURN_ANGLE * 1.5,
        outwardAngle + TURN_ANGLE * 2,
        outwardAngle - TURN_ANGLE * 2,
        outwardAngle + Math.PI,
      ];
      const rankedAngles = angleCandidates.map((angle, index) => {
        const point = pointAt(ringPoint, angle);
        return {
          angle,
          index,
          point,
          clearance: candidateClearance(point, ringPoint, positions, segments),
          crossesRingInterior: attachmentCrossesRingInterior(ringPoint, point, rings, positions),
          rawDifference: Math.abs(Math.atan2(Math.sin(angle - rawAngle), Math.cos(angle - rawAngle))),
        };
      }).sort((left, right) => {
        if (left.crossesRingInterior !== right.crossesRingInterior) {
          return left.crossesRingInterior ? 1 : -1;
        }
        const leftSafe = left.clearance >= BOND_LENGTH * 0.55;
        const rightSafe = right.clearance >= BOND_LENGTH * 0.55;
        if (leftSafe !== rightSafe) return leftSafe ? -1 : 1;
        if (leftSafe) return left.rawDifference - right.rawDifference || left.index - right.index;
        return right.clearance - left.clearance || left.rawDifference - right.rawDifference || left.index - right.index;
      });
      const attachmentAngle = rankedAngles[0].angle;
      const childPoint = rankedAngles[0].point;
      positions.set(childId, childPoint);
      visited.add(childId);
      segments.push([ringPoint, childPoint]);
      placeDescendants(ringAtomId, childId, attachmentAngle, 1);
    }
  }

  // Keep malformed or disconnected imported fragments visible and deterministic.
  molecule.atoms.forEach((atom) => {
    if (!positions.has(atom.id)) {
      positions.set(atom.id, { x: atom.x * X_SCALE, y: atom.y * Y_SCALE });
    }
  });
  return positions;
}

/**
 * Derives display coordinates from the same molecular graph for each view.
 *
 * Open molecules use line-angle or text-first geometry by view. Ring
 * vertices retain their editor/imported polygons while attached acyclic
 * components are laid out radially and then zigzag. This is display-only: no
 * chemical or editor coordinates are mutated here.
 */
export function calculateMolecule2DLayout(
  molecule: LayoutMolecule,
  mainChain: readonly number[],
  viewMode: ViewMode = "skeletal",
): Map<number, SkeletalPoint | SemiDevelopedPoint> {
  const saved = molecule.incrementalLayout;
  if (saved && saved.signature === layoutSignature(molecule)) {
    const points = viewMode === "semi-developed" ? saved.semiDeveloped : saved.skeletal;
    if (points.length === molecule.atoms.length && points.every(({id, x, y}) =>
      molecule.atoms.some((atom) => atom.id === id) && Number.isFinite(x) && Number.isFinite(y))) {
      return new Map(points.map(({id, x, y}) => [id, {x, y}]));
    }
  }
  if (viewMode === "semi-developed") {
    let displayBackbone = mainChain;
    if (molecule.stableSkeletalOrientation && mainChain.length > 1) {
      const atoms = new Map(molecule.atoms.map((atom) => [atom.id, atom]));
      const first = atoms.get(mainChain[0]);
      const last = atoms.get(mainChain[mainChain.length - 1]);
      if (first && last && ((molecule.isMirrored ? first.x < last.x : first.x > last.x)
        || (first.x === last.x && first.y > last.y))) {
        displayBackbone = [...mainChain].reverse();
      }
    }
    return calculateSemiDevelopedLayout(molecule, displayBackbone, semiDevelopedStereoBonds(molecule));
  }
  const explicitRings = molecule.rings ?? [];
  const inferredCycle = explicitRings.length ? null : findOrderedSimpleMonocycle(molecule);
  const rings = explicitRings.length
    ? explicitRings
    : inferredCycle ? [{ atomIds: inferredCycle, inferred: true }]
      : [];
  if (!rings.length) return buildOpenChainSkeletalPositions(molecule, mainChain);

  return buildRingAwarePositions(molecule, rings);
}

/** Preserve the two projections across a single acyclic manual carbon addition.
 * Snapshots belong to an exact graph and editor geometry; any explicit edit,
 * reflection, import or bond change invalidates them automatically. */
export function preserveIncrementalLayout<T extends LayoutMolecule>(
  before: T, next: T, previousBackbone: readonly number[], parentId: number, newId: number,
  requestedDirection?: { x: number; y: number },
): T | null {
  if (before.rings?.length || next.rings?.length || findOrderedSimpleMonocycle(next)
    || next.bonds.length !== next.atoms.length - 1
    || next.atoms.length !== before.atoms.length + 1 || next.bonds.length !== before.bonds.length + 1
    || !before.atoms.every((atom) => next.atoms.some((other) => other.id === atom.id && other.x === atom.x && other.y === atom.y))
    || !before.bonds.every((bond) => next.bonds.some((other) => JSON.stringify(other) === JSON.stringify(bond)))) return next;
  const newBond = next.bonds.find(([a,b]) => (a === parentId && b === newId) || (b === parentId && a === newId));
  if (!newBond) return next;
  const cleanNext = {...next, incrementalLayout: undefined};
  const provisionalBackbone = previousBackbone.at(-1) === parentId
    ? [...previousBackbone, newId]
    : previousBackbone[0] === parentId ? [newId, ...previousBackbone] : previousBackbone;
  const snapshots: Partial<Record<"skeletal" | "semi-developed", Array<{id:number;x:number;y:number}>>> = {};
  const adjustments: IncrementalLayout["adjustments"] = [];
  for (const mode of ["skeletal", "semi-developed"] as const) {
    const existing = calculateMolecule2DLayout(before, previousBackbone, mode);
    const proposed = calculateMolecule2DLayout(cleanNext, provisionalBackbone, mode);
    const origin = existing.get(parentId), proposedOrigin = proposed.get(parentId), proposedNew = proposed.get(newId);
    if (!origin || !proposedOrigin || !proposedNew) return null;
    const dx = proposedNew.x - proposedOrigin.x, dy = proposedNew.y - proposedOrigin.y;
    const length = Math.hypot(dx, dy);
    if (length < 1e-6) return null;
    let angle = Math.atan2(dy, dx);
    const previousBonds = before.bonds.filter(([a,b]) => a === parentId || b === parentId);
    const linearBond = previousBonds.length === 1 && ((newBond[2] ?? 1) === 3 || (previousBonds[0][2] ?? 1) === 3)
      ? previousBonds[0] : undefined;
    if (linearBond) {
      const neighbor = existing.get(linearBond[0] === parentId ? linearBond[1] : linearBond[0]);
      if (neighbor) angle = Math.atan2(origin.y - neighbor.y, origin.x - neighbor.x);
    }
    const step = mode === "skeletal" ? Math.PI / 6 : Math.PI / 2;
    const turns = linearBond ? [0] : mode === "skeletal"
      ? [0, 2, -2, 4, -4, 6, 1, -1, 3, -3, 5, -5] : [0, 1, -1, 2];
    const candidates = [1, 1.5, 2].flatMap((scale) => turns.map((turn) => ({
      turn,
      scale,
      x: origin.x + Math.cos(angle + turn * step) * length * scale,
      y: origin.y + Math.sin(angle + turn * step) * length * scale,
    })));
    const candidateFits = (candidate: typeof candidates[number]) => {
      if (requestedDirection && (candidate.x-origin.x)*requestedDirection.x
        + (candidate.y-origin.y)*requestedDirection.y <= length * 1e-6) return false;
      if ([...existing].some(([id,p]) => id !== parentId && Math.hypot(candidate.x-p.x,candidate.y-p.y) < length * 0.55)) return false;
      if ([...existing].some(([id,p]) => id !== parentId
        && distanceToSegment(p, origin, candidate) < length * 0.2)) return false;
      if (requestedDirection && previousBonds.some(([a,b]) => {
        const neighbor = existing.get(a === parentId ? b : a);
        if (!neighbor) return false;
        const vx = neighbor.x-origin.x, vy = neighbor.y-origin.y;
        const cosine = ((candidate.x-origin.x)*vx + (candidate.y-origin.y)*vy) / (length * candidate.scale * Math.hypot(vx,vy));
        return cosine > Math.cos(Math.PI / 4) + 1e-8;
      })) return false;
      if (before.bonds.some(([a,b]) => {
        if (a === parentId || b === parentId) return false;
        const start = existing.get(a), end = existing.get(b);
        return start && end && incrementalSegmentDistance(origin, candidate, start, end) < length * 0.15;
      })) return false;
      const projected = {...next, atoms: next.atoms.map((atom) => ({...atom,
        ...(atom.id === newId ? {x: candidate.x, y: candidate.y} : existing.get(atom.id) ?? atom)}))};
      // Keep every explicit substituent on its geometric side of a defined
      // double bond, including a lower-priority ligand that may later become
      // higher priority after further editing.
      const stereoSideValid = next.bonds.every(([a,b,order = 1,defined]) => {
        if (order !== 2 || (parentId !== a && parentId !== b)) return true;
        const left = next.atoms.find((atom) => atom.id === a), right = next.atoms.find((atom) => atom.id === b);
        if ((left?.element ?? "C") !== "C" || (right?.element ?? "C") !== "C") return true;
        const other = parentId === a ? b : a;
        const referenceBond = before.bonds.find(([u,v]) =>
          (u === parentId && v !== other) || (v === parentId && u !== other));
        if (!referenceBond) return true;
        const referenceId = referenceBond[0] === parentId ? referenceBond[1] : referenceBond[0];
        const raw = new Map(next.atoms.map((atom) => [atom.id,atom]));
        const start = raw.get(parentId), end = raw.get(other), ref = raw.get(referenceId), added = raw.get(newId);
        const shownStart = existing.get(parentId), shownEnd = existing.get(other), shownRef = existing.get(referenceId);
        if (!start || !end || !ref || !added || !shownStart || !shownEnd || !shownRef) return false;
        const side = (p: SkeletalPoint,q: SkeletalPoint,r: SkeletalPoint) =>
          (q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
        const rawProduct = side(start,end,ref)*side(start,end,added);
        const shownProduct = side(shownStart,shownEnd,shownRef)*side(shownStart,shownEnd,candidate);
        if (rawProduct >= -1e-8) return false;
        // An unassigned alkene may legitimately use a straight textual
        // backbone, which has no visible side for its existing ligand yet.
        return shownProduct < -1e-8 || (defined !== true && Math.abs(shownProduct) <= 1e-8);
      });
      if (!stereoSideValid) return false;
      return next.bonds.every(([a,b,order = 1,defined]) => {
        if (order !== 2 || defined !== true) return true;
        const actual = inspectDoubleBondStereochemistry(next,a,b);
        if (!actual.stereogenic || !actual.configuration) return true;
        const display = inspectDoubleBondStereochemistry(projected,a,b);
        return display.stereogenic && display.configuration === actual.configuration;
      });
    };
    let point = candidates.find(candidateFits);
    let relocatedAtomId: number | undefined;
    if (!point && mode === "semi-developed" && requestedDirection) {
      // If a single unconstrained terminal atom blocks every requested lane,
      // try the smallest local move of that terminal. Never move an alkene
      // endpoint or a ligand attached to an assigned tetrahedral center.
      const moves: Array<{id:number; point:SkeletalPoint; distance:number}> = [];
      for (const atom of before.atoms) {
        if (atom.id === parentId || atom.tetrahedralParity || (atom.element ?? "C") !== "C") continue;
        const incident = before.bonds.filter(([a,b]) => a === atom.id || b === atom.id);
        if (incident.length !== 1 || (incident[0][2] ?? 1) !== 1) continue;
        const anchorId = incident[0][0] === atom.id ? incident[0][1] : incident[0][0];
        const anchorAtom = before.atoms.find((item) => item.id === anchorId);
        if (anchorId === parentId || anchorAtom?.tetrahedralParity || (anchorAtom?.element ?? "C") !== "C"
          || before.bonds.some(([a,b,order = 1]) => order !== 1 && (a === anchorId || b === anchorId))
          || before.bonds.some(([a,b,order = 1]) => order !== 1 && (a === atom.id || b === atom.id))) continue;
        const old = existing.get(atom.id), anchor = existing.get(anchorId);
        if (!old || !anchor) continue;
        const bondLength = Math.hypot(old.x-anchor.x,old.y-anchor.y);
        for (const turn of [0,1,2,3]) {
          const target = {x:anchor.x+Math.cos(turn*Math.PI/2)*bondLength,y:anchor.y+Math.sin(turn*Math.PI/2)*bondLength};
          const distance = Math.hypot(target.x-old.x,target.y-old.y);
          if (distance < 1e-6) continue;
          moves.push({id:atom.id,point:target,distance});
        }
      }
      moves.sort((a,b) => a.distance-b.distance || a.point.x-b.point.x || a.point.y-b.point.y);
      for (const move of moves) {
        const old = existing.get(move.id)!;
        const edge = before.bonds.find(([a,b]) => a === move.id || b === move.id)!;
        const anchorId = edge[0] === move.id ? edge[1] : edge[0];
        const anchor = existing.get(anchorId)!;
        if ([...existing].some(([id,p]) => id !== move.id && id !== anchorId
          && (Math.hypot(p.x-move.point.x,p.y-move.point.y)<length*0.55
            || distanceToSegment(p,anchor,move.point)<length*0.2))) continue;
        if (before.bonds.some(([a,b]) => {
          if (a === move.id || b === move.id || a === anchorId || b === anchorId) return false;
          const start=existing.get(a),end=existing.get(b);
          return start && end && incrementalSegmentDistance(anchor,move.point,start,end)<length*0.15;
        })) continue;
        existing.set(move.id,move.point);
        point = candidates.find(candidateFits);
        if (point) { relocatedAtomId=move.id; break; }
        existing.set(move.id,old);
      }
    }
    if (!point) return null;
    if (point.turn || point.scale !== 1 || relocatedAtomId !== undefined) adjustments.push({view: mode, atomId: newId, turnSteps: point.turn, scale: point.scale,
      ...(relocatedAtomId === undefined ? {} : {relocatedAtomId})});
    snapshots[mode] = [...existing].map(([id,p]) => ({id,...p})).concat([{id:newId,x:point.x,y:point.y}]);
  }
  return {...next, incrementalLayout: {signature: layoutSignature(next),
    skeletal: snapshots.skeletal!, semiDeveloped: snapshots["semi-developed"]!, adjustments}};
}

/** The editor coordinates and the canvas projection can have different
 * orientations. Try equivalent local editor placements while retaining the
 * requested screen direction and every existing coordinate. */
export function preserveDirectionalCarbonAddition<T extends LayoutMolecule>(
  before: T, next: T, previousBackbone: readonly number[], parentId: number, newId: number,
  direction: {x:number;y:number}, alternatives: readonly SkeletalPoint[],
): T | null {
  const original = next.atoms.find((atom) => atom.id === newId);
  if (!original) return null;
  for (const point of [original,...alternatives]) {
    if (before.atoms.some((atom) => Math.hypot(atom.x-point.x,atom.y-point.y)<1e-6)) continue;
    const candidate = {...next, atoms: next.atoms.map((atom) => atom.id === newId
      ? {...atom,x:point.x,y:point.y} : atom)} as T;
    const positioned = preserveIncrementalLayout(before,candidate,previousBackbone,parentId,newId,direction);
    if (positioned) return positioned;
  }
  return null;
}

/** Apply the user's explicit reflection to the preserved projections too. */
export function reflectIncrementalLayout<T extends LayoutMolecule>(before: T, reflected: T): T {
  const saved = before.incrementalLayout;
  if (!saved || saved.signature !== layoutSignature(before)) return reflected;
  const reflect = (points: IncrementalLayout["skeletal"]) => {
    const xs = points.map((point) => point.x);
    const sum = Math.min(...xs) + Math.max(...xs);
    return points.map((point) => ({...point, x: sum - point.x}));
  };
  return {...reflected, incrementalLayout: {signature: layoutSignature(reflected),
    skeletal: reflect(saved.skeletal), semiDeveloped: reflect(saved.semiDeveloped), adjustments: saved.adjustments.map((adjustment) => ({...adjustment}))}};
}

/** Apply the same no-reflow rule to an automatically placed tree attachment. */
export function preserveIncrementalAttachment<T extends LayoutMolecule>(
  before: T, next: T, previousBackbone: readonly number[],
): T | null {
  if (before.rings?.length || next.rings?.length || next.bonds.length !== next.atoms.length - 1
    || next.atoms.length <= before.atoms.length) return next;
  const placedIds = new Set(before.atoms.map((atom) => atom.id));
  const pending = next.atoms.filter((atom) => !placedIds.has(atom.id));
  if (pending.length !== next.atoms.length - before.atoms.length) return null;
  let current: T = before;
  while (pending.length) {
    const index = pending.findIndex((atom) => next.bonds.filter(([a,b]) =>
      (a === atom.id && placedIds.has(b)) || (b === atom.id && placedIds.has(a))).length === 1);
    if (index < 0) return null;
    const atom = pending.splice(index,1)[0];
    const bond = next.bonds.find(([a,b]) =>
      (a === atom.id && placedIds.has(b)) || (b === atom.id && placedIds.has(a)))!;
    const parent = bond[0] === atom.id ? bond[1] : bond[0];
    const nextIds = new Set([...placedIds,atom.id]);
    const partial = {...next, incrementalLayout: undefined,
      atoms: next.atoms.filter((item) => nextIds.has(item.id)),
      bonds: next.bonds.filter(([a,b]) => nextIds.has(a) && nextIds.has(b))} as T;
    const positioned = preserveIncrementalLayout(current,partial,previousBackbone,parent,atom.id);
    if (!positioned?.incrementalLayout) return null;
    current = positioned;
    placedIds.add(atom.id);
  }
  return current;
}
