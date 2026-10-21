import { getSemiDevelopedLabelExtent } from "./semi-developed-label-geometry.ts";
import { TETRAHEDRAL_BADGE_RADIUS, type TetrahedralStereoCenter } from "./tetrahedral-stereochemistry.ts";
import { semiDevelopedStereoAccessibleLabel } from "./semi-developed-stereo.ts";

/** Informational and exportable: no action, tab stop or editor hit target. */
export function SemiDevelopedStereoBadgeSvg({ center, position, scale, language, locant }: {
  center: TetrahedralStereoCenter;
  position: { x: number; y: number };
  scale: number;
  language: "es" | "en";
  locant?: number;
}) {
  const label = semiDevelopedStereoAccessibleLabel(center, language, locant);
  return (
    <g className="tetrahedral-center-marker semi-developed-stereo-marker"
      data-stereo-atom-id={center.atomId}
      transform={`translate(${position.x} ${position.y}) scale(${scale})`}
      role="img" aria-label={label}>
      <title>{label}</title>
      <circle className="tetrahedral-center-badge" r={TETRAHEDRAL_BADGE_RADIUS} />
      <text textAnchor="middle" dominantBaseline="central">{center.configuration}</text>
    </g>
  );
}

/** Semi-developed atom glyph and hit target; interaction handlers stay on the owning canvas node. */
export function SemiDevelopedAtomSvg({
  label,
  hydrogenSubscript,
  charge,
  selected,
  labelScale,
}: {
  label: string;
  hydrogenSubscript?: number;
  charge: string;
  selected: boolean;
  labelScale: number;
}) {
  const labelExtent = getSemiDevelopedLabelExtent(
    label,
    hydrogenSubscript,
    charge,
    labelScale,
  );
  return (
    <g className="semi-developed-glyph" aria-hidden="true" pointerEvents="none">
      {selected && <circle className="selection-ring semi-developed-selection-ring" data-editor-only="true" r={labelExtent.hitRadius + 7} />}
      <circle className="semi-developed-hover-ring" data-editor-only="true" aria-hidden="true" r={labelExtent.hitRadius + 3} />
      <g transform={labelScale === 1 ? undefined : `scale(${labelScale})`}>
      <text className="atom-label semi-developed-label" textAnchor="middle" dominantBaseline="central">
        <tspan>{label}</tspan>
        {hydrogenSubscript && (
          <tspan className="hydrogen-subscript" baselineShift="sub">{hydrogenSubscript}</tspan>
        )}
        {charge && <tspan className="atom-charge" baselineShift="super">{charge}</tspan>}
      </text>
      </g>
      <circle
        className="semi-developed-hit-target"
        data-editor-only="true"
        aria-hidden="true"
        r={labelExtent.hitRadius}
        fill="transparent"
        pointerEvents="all"
      />
    </g>
  );
}
