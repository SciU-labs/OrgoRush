import type { CondensedToken } from "../../app/condensed-layout.ts";
import type { ReadonlyStereoMolecule, StereoMolecule } from "../../app/double-bond-stereochemistry.ts";
import type { WorkerEnv } from "../../worker/env.ts";
import { inspectDoubleBondStereochemistry } from "../../app/double-bond-stereochemistry.ts";
import { buildOpenChainSkeletalPositions } from "../../app/skeletal-layout.ts";
import { calculateMolecule2DLayout } from "../../app/molecule-2d-layout.ts";
import { calculateSemiDevelopedLayout } from "../../app/semi-developed-layout.ts";

type Assert<T extends true> = T;
type IsNever<T> = [T] extends [never] ? true : false;
type Open = Extract<CondensedToken, { type: "branch-open" }>;
type Close = Extract<CondensedToken, { type: "branch-close" }>;
export type OpenExists = Assert<IsNever<Open> extends false ? true : false>;
export type CloseExists = Assert<IsNever<Close> extends false ? true : false>;
export type ExactOpenText = Assert<Open["text"] extends "(" ? true : false>;
export type ExactCloseText = Assert<Close["text"] extends ")" ? true : false>;
export type MutableGraphIsReadable = Assert<StereoMolecule extends ReadonlyStereoMolecule ? true : false>;
export type SharedD1Binding = Assert<WorkerEnv["DB"] extends typeof import("cloudflare:workers").env.DB ? true : false>;

// Readonly collections retain the real element, bond-order and stereo types.
// This function is compiled, never executed by the application or test runner.
export function checkLayoutConsumers(molecule: ReadonlyStereoMolecule, parent: readonly number[]) {
  inspectDoubleBondStereochemistry(molecule, 1, 2);
  buildOpenChainSkeletalPositions(molecule, parent);
  calculateMolecule2DLayout(molecule, parent);
  calculateSemiDevelopedLayout(molecule, parent);
}
