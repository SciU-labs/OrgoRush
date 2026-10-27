import { useEffect, useMemo, useState } from "react";
import { createReasoningVisualController, type ReasoningVisualTarget } from "./reasoning-visual-targets";

/** Context and graph-reference checks prevent even one render of a stale highlight. */
export function useReasoningVisualInteraction(contextKey: string, molecule: object, enabled: boolean) {
  const [reference, setReference] = useState<{ key: string; molecule: object; target: ReasoningVisualTarget } | null>(null);
  const controller = useMemo(() => createReasoningVisualController(target =>
    setReference(target ? { key: contextKey, molecule, target } : null)), [contextKey, molecule]);
  useEffect(() => {
    setReference(null);
    return () => controller.dispose();
  }, [controller, enabled]);
  return {
    target: enabled && reference?.key === contextKey && reference.molecule === molecule ? reference.target : null,
    activate: (target: ReasoningVisualTarget) => { if (enabled) controller.activate(target); },
    clear: () => controller.clear(),
  };
}

export function ReasoningStepNumber({ number, title, language, target, active, onActivate }: {
  number: string; title: string; language: "es" | "en"; target?: ReasoningVisualTarget;
  active: boolean; onActivate: (target: ReasoningVisualTarget) => void;
}) {
  return target
    ? <button type="button" className="reasoning-step-number" aria-pressed={active}
        aria-label={language === "en" ? `Step ${number}: ${title}. Highlight in the molecule for two seconds`
          : `Paso ${number}: ${title}. Resaltar en la molécula durante dos segundos`}
        onClick={() => onActivate(target)}>{number}</button>
    : <span>{number}</span>;
}

/** An editor-only SVG overlay; original atom/bond paint and editing selection stay intact. */
export function ReasoningVisualOverlay({ target, positions, showLocants, semiDeveloped = false, numberOffsets }: {
  target: ReasoningVisualTarget | null;
  positions: ReadonlyMap<number, { x: number; y: number }>;
  showLocants: boolean; semiDeveloped?: boolean;
  numberOffsets?: ReadonlyMap<number, { x: number; y: number }>;
}) {
  if (!target) return null;
  return <g className="reasoning-visual-overlay" data-editor-only="true" aria-hidden="true" pointerEvents="none">
    {target.bondIds.map(([a, b]) => {
      const start = positions.get(a), end = positions.get(b);
      return start && end ? <line key={`${a}:${b}`} className="reasoning-bond-halo reasoning-visual-bond"
        data-reasoning-bond={`${a}:${b}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} /> : null;
    })}
    {target.atomIds.map(id => {
      const position = positions.get(id);
      return position ? <circle key={id} className="reasoning-visual-atom" data-reasoning-atom={id}
        cx={position.x} cy={position.y} r={semiDeveloped ? 32 : 19} /> : null;
    })}
    {showLocants && target.locants.map(([id, locant]) => {
      const position = positions.get(id), offset = numberOffsets?.get(id) ?? { x: 16, y: -24 };
      return position ? <g className="reasoning-visual-locant" key={id} data-reasoning-locant={id}
        transform={`translate(${position.x + offset.x} ${position.y + offset.y})`}>
        <circle r="12" /><text textAnchor="middle" dominantBaseline="central">{locant}</text>
      </g> : null;
    })}
  </g>;
}
