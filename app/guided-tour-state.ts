export const GUIDED_TOUR_STORAGE_KEY = "hydrocarbonLab.guidedTour.v1";
export const GUIDED_TOUR_STEP_COUNT = 5;

export type GuidedTourDecision = "completed" | "skipped";
export function isTourCarbonPair(molecule: { atoms: readonly { id: number; element?: string }[]; bonds: readonly (readonly [number, number, number?])[]; rings?: readonly unknown[] }, order: number): boolean {
  return molecule.atoms.length === 2 && molecule.atoms.every((atom) => !atom.element || atom.element === "C")
    && molecule.bonds.length === 1 && (molecule.bonds[0][2] ?? 1) === order
    && molecule.bonds[0][0] !== molecule.bonds[0][1]
    && molecule.bonds[0].slice(0, 2).every((id) => molecule.atoms.some((atom) => atom.id === id))
    && !molecule.rings?.length;
}
export type GuidedTourCompletion = GuidedTourDecision | "pending";
export type GuidedTourTarget =
  | "carbon"
  | "add-carbon"
  | "bond-controls"
  | "name"
  | "reasoning"
  | "settings"
  | "tools";

export type GuidedTourState = {
  ready: boolean;
  open: boolean;
  step: number;
  carbonPhase: "select" | "add";
  settingsOpenedFromTour: boolean;
  completion: GuidedTourCompletion;
};

export type GuidedTourAction =
  | { type: "initialize"; decision: GuidedTourDecision | null }
  | { type: "open" }
  | { type: "previous" }
  | { type: "next" }
  | { type: "carbon-selected" }
  | { type: "carbon-added" }
  | { type: "bond-order-changed" }
  | { type: "reasoning-opened" }
  | { type: "reasoning-fragment-activated" }
  | { type: "settings-opened"; fromGuidedStep: boolean }
  | { type: "settings-closed" }
  | { type: "tools-opened" }
  | { type: "dismiss" }
  | { type: "complete" };

export const INITIAL_GUIDED_TOUR_STATE: GuidedTourState = {
  ready: false,
  open: false,
  step: 0,
  carbonPhase: "add",
  settingsOpenedFromTour: false,
  completion: "pending",
};

const stepTargets: readonly GuidedTourTarget[] = [
  "add-carbon",
  "bond-controls",
  "name",
  "reasoning",
  "tools",
];

export function guidedTourReducer(state: GuidedTourState, action: GuidedTourAction): GuidedTourState {
  switch (action.type) {
    case "initialize":
      if (state.ready) return state;
      return {
        ready: true,
        open: action.decision === null,
        step: 0,
        carbonPhase: "add",
        settingsOpenedFromTour: false,
        completion: action.decision ?? "pending",
      };
    case "open":
      return { ...state, ready: true, open: true, step: 0, carbonPhase: "add", settingsOpenedFromTour: false };
    case "previous":
      return state.open
        ? { ...state, step: Math.max(0, state.step - 1), carbonPhase: "select", settingsOpenedFromTour: false }
        : state;
    case "next":
      if (!state.open) return state;
      if (state.step >= GUIDED_TOUR_STEP_COUNT - 1) {
        return { ...state, open: false, carbonPhase: "select", settingsOpenedFromTour: false, completion: "completed" };
      }
      return { ...state, step: state.step + 1, carbonPhase: "select", settingsOpenedFromTour: false };
    case "carbon-selected":
      return state.open && state.step === 0 && state.carbonPhase === "select"
        ? { ...state, carbonPhase: "add" }
        : state;
    case "carbon-added":
      return state.open && state.step === 0
        ? { ...state, step: 1, carbonPhase: "select", settingsOpenedFromTour: false }
        : state;
    case "bond-order-changed":
      return state.open && state.step === 1
        ? { ...state, step: 2, carbonPhase: "select", settingsOpenedFromTour: false }
        : state;
    case "reasoning-opened":
      return state;
    case "reasoning-fragment-activated":
      return state.open && state.step === 3
        ? { ...state, step: 4, carbonPhase: "select", settingsOpenedFromTour: false }
        : state;
    case "settings-opened":
      return {
        ...state,
        settingsOpenedFromTour: action.fromGuidedStep && state.open && state.step === 5,
      };
    case "settings-closed":
      return state.settingsOpenedFromTour && state.open && state.step === 5
        ? { ...state, step: 6, carbonPhase: "select", settingsOpenedFromTour: false }
        : state.settingsOpenedFromTour ? { ...state, settingsOpenedFromTour: false } : state;
    case "tools-opened":
      return state.open && state.step === 6
        ? { ...state, open: false, carbonPhase: "select", settingsOpenedFromTour: false, completion: "completed" }
        : state;
    case "dismiss":
      return {
        ...state,
        open: false,
        carbonPhase: "select",
        settingsOpenedFromTour: false,
        completion: state.completion === "pending" ? "skipped" : state.completion,
      };
    case "complete":
      return { ...state, open: false, carbonPhase: "select", settingsOpenedFromTour: false, completion: "completed" };
  }
}

export function readGuidedTourDecision(storage: Pick<Storage, "getItem">): GuidedTourDecision | null {
  try {
    const value = storage.getItem(GUIDED_TOUR_STORAGE_KEY);
    return value === "completed" || value === "skipped" ? value : null;
  } catch {
    return null;
  }
}

export function writeGuidedTourDecision(
  storage: Pick<Storage, "setItem">,
  decision: GuidedTourDecision,
): boolean {
  try {
    storage.setItem(GUIDED_TOUR_STORAGE_KEY, decision);
    return true;
  } catch {
    return false;
  }
}

export function guidedTourTargetForStep(step: number, carbonPhase: "select" | "add" = "select"): GuidedTourTarget {
  if (step === 0 && carbonPhase === "add") return "add-carbon";
  return stepTargets[Math.min(Math.max(step, 0), stepTargets.length - 1)];
}

export function guidedTourIsSuspendedByOverlay(overlays: {
  historyOpen: boolean;
  settingsOpen: boolean;
  exportOpen: boolean;
  canvasExpanded: boolean;
}): boolean {
  return overlays.historyOpen || overlays.settingsOpen || overlays.exportOpen || overlays.canvasExpanded;
}

export type GuidedTourCopy = {
  title: string;
  description: string;
  followUp?: string;
  action?: string;
  exampleAction?: string;
  exampleNote?: string;
};

export function guidedTourCopy(
  language: "es" | "en",
  step: number,
  options: {
    hasInteractiveName?: boolean;
    acetoneAlreadyLoaded?: boolean;
    needsExampleForReasoning?: boolean;
    isPristineInitialMolecule?: boolean;
    carbonPhase?: "select" | "add";
    isEthene?: boolean;
    reasoningOpen?: boolean;
    hasCarbon?: boolean;
    isEthane?: boolean;
    canAddCarbon?: boolean;
    hasEditableBond?: boolean;
  } = {},
): GuidedTourCopy {
  const english = language === "en";
  const currentStep = Math.min(Math.max(step, 0), GUIDED_TOUR_STEP_COUNT - 1);

  switch (currentStep) {
    case 0:
      return english ? {
        title: "Build your first molecule",
        description: options.hasCarbon === false
          ? "Your current structure has no carbon to select. Continue the tour, or add a carbon using the editor."
          : options.carbonPhase === "select"
          ? "Select a carbon in the canvas, then use an Add C arrow below it."
          : options.canAddCarbon === false
            ? "The selected carbon cannot accept this bond. Select another carbon or continue the tour."
          : options.isPristineInitialMolecule
            ? "We've started with one carbon. Select a single bond, then use the → Add C arrow below the canvas."
            : "Use an Add C arrow below the canvas to add a carbon. Your structure stays yours to edit.",
      } : {
        title: "Construye tu primera molécula",
        description: options.hasCarbon === false
          ? "Tu estructura actual no tiene carbono para seleccionar. Continúa la guía o agrega un carbono con el editor."
          : options.carbonPhase === "select"
          ? "Selecciona un carbono en el canvas y luego usa una flecha Añadir C."
          : options.canAddCarbon === false
            ? "El carbono seleccionado no puede aceptar este enlace. Selecciona otro carbono o continúa la guía."
          : options.isPristineInitialMolecule
            ? "Empezamos con un carbono. Elige enlace simple y luego usa la flecha → Añadir C bajo el canvas."
            : "Usa una flecha Añadir C bajo el canvas para agregar un carbono. Tú decides cómo editar tu estructura.",
      };
    case 1:
      return english ? {
        title: "Change the bond",
        description: options.isEthane ? "Activate the bond between the two carbons to change it from single to double." : options.hasEditableBond === false ? "No carbon–carbon bond can be changed here. Continue the tour to explore the name." : "Activate an editable carbon–carbon bond to change its order, or continue the tour.",
      } : {
        title: "Cambia el enlace",
        description: options.isEthane ? "Activa el enlace entre los dos carbonos para cambiarlo de simple a doble." : options.hasEditableBond === false ? "No hay un enlace entre carbonos que se pueda cambiar aquí. Continúa la guía para explorar el nombre." : "Activa un enlace editable entre carbonos para cambiar su orden, o continúa la guía.",
      };
    case 2:
      return english ? {
        title: options.isEthene ? "Meet your molecule: ethene!" : "Meet your molecule",
        description: "The IUPAC name updates automatically whenever you change the structure.",
      } : {
        title: options.isEthene ? "Conoce tu molécula: ¡eteno!" : "Conoce tu molécula",
        description: "El nombre IUPAC se actualiza automáticamente cuando cambias la estructura.",
      };
    case 3:
      return english ? {
        title: "Understand the name",
        description: options.needsExampleForReasoning
          ? "An explanation is not available for this structure. Continue exploring or return to a named molecule."
          : options.reasoningOpen && options.hasInteractiveName
            ? "Select a highlighted name fragment to explore its meaning."
          : options.hasInteractiveName
            ? "Open ‘How it is derived’, then select a highlighted name fragment to explore its meaning."
            : options.reasoningOpen ? "Explore the rules in ‘How it is derived’." : "Open ‘How it is derived’ to explore the rules behind the name.",
      } : {
        title: "Comprende el nombre",
        description: options.needsExampleForReasoning
          ? "No hay una explicación disponible para esta estructura. Continúa explorando o vuelve a una molécula con nombre."
          : options.reasoningOpen && options.hasInteractiveName
            ? "Selecciona un fragmento resaltado del nombre para explorar su significado."
          : options.hasInteractiveName
            ? "Abre «Cómo se obtiene» y selecciona un fragmento resaltado del nombre para explorar su significado."
            : options.reasoningOpen ? "Explora las reglas en «Cómo se obtiene»." : "Abre «Cómo se obtiene» para explorar las reglas detrás del nombre.",
      };
    default:
      return english ? {
        title: "You're ready to explore!",
        description: "Build more molecules, try By name or Examples, or challenge yourself in Practice / Exam. Happy exploring!",
      } : {
        title: "¡Ya puedes explorar!",
        description: "Construye más moléculas, prueba Por nombre o Ejemplos, o desafíate en Práctica / Examen. ¡Que disfrutes explorando!",
      };
  }

}

export function guidedTourControls(language: "es" | "en") {
  return language === "en"
    ? {
        open: "How to use?",
        close: "Close guide",
        skip: "Skip tour",
        previous: "Previous",
        next: "Next",
        finish: "Start exploring",
        progress: (step: number) => `Step ${step + 1} of ${GUIDED_TOUR_STEP_COUNT}`,
      }
    : {
        open: "¿Cómo se usa?",
        close: "Cerrar guía",
        skip: "Omitir",
        previous: "Anterior",
        next: "Siguiente",
        finish: "Empezar a explorar",
        progress: (step: number) => `Paso ${step + 1} de ${GUIDED_TOUR_STEP_COUNT}`,
      };
}

export type GuidedTourBox = { top: number; right: number; bottom: number; left: number; width?: number; height?: number };
export type GuidedTourPlacement = { top: number; left: number; side: "above" | "below" | "left" | "right" };

export function placeGuidedTourCard(options: {
  anchor: GuidedTourBox;
  card: { width: number; height: number };
  viewport: { width: number; height: number };
  dockHeight?: number;
  preferHorizontal?: boolean;
  preferAbove?: boolean;
  margin?: number;
  gap?: number;
}): GuidedTourPlacement {
  const { anchor, card, viewport } = options;
  const margin = options.margin ?? 12;
  const gap = options.gap ?? 10;
  const safeBottom = Math.max(margin, viewport.height - (options.dockHeight ?? 58) - margin);
  const maxLeft = Math.max(margin, viewport.width - card.width - margin);
  const maxTop = Math.max(margin, safeBottom - card.height);
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

  if (options.preferHorizontal) {
    const rightLeft = anchor.right + gap;
    if (rightLeft + card.width <= viewport.width - margin) {
      return { top: clamp(anchor.top, margin, maxTop), left: rightLeft, side: "right" };
    }
    const leftLeft = anchor.left - gap - card.width;
    if (leftLeft >= margin) {
      return { top: clamp(anchor.top, margin, maxTop), left: leftLeft, side: "left" };
    }
  }

  const belowTop = anchor.bottom + gap;
  const aboveTop = anchor.top - gap - card.height;
  if (options.preferAbove && aboveTop >= margin) {
    return {
      top: Math.min(aboveTop, maxTop),
      left: clamp(anchor.left + (anchor.right - anchor.left - card.width) / 2, margin, maxLeft),
      side: "above",
    };
  }

  if (belowTop + card.height <= safeBottom) {
    return {
      top: belowTop,
      left: clamp(anchor.left + (anchor.right - anchor.left - card.width) / 2, margin, maxLeft),
      side: "below",
    };
  }

  if (aboveTop >= margin) {
    return {
      top: Math.min(aboveTop, maxTop),
      left: clamp(anchor.left + (anchor.right - anchor.left - card.width) / 2, margin, maxLeft),
      side: "above",
    };
  }

  const aboveSpace = anchor.top - margin - gap;
  const belowSpace = safeBottom - anchor.bottom - gap;
  const side = aboveSpace >= belowSpace ? "above" : "below";
  const desiredTop = side === "above" ? anchor.top - gap - card.height : belowTop;
  return {
    top: clamp(desiredTop, margin, maxTop),
    left: clamp(anchor.left + (anchor.right - anchor.left - card.width) / 2, margin, maxLeft),
    side,
  };
}

export function guidedTourScrollDelta(options: {
  anchor: Pick<GuidedTourBox, "top" | "bottom">;
  viewportHeight: number;
  dockHeight?: number;
  margin?: number;
  targetTop?: number;
}): number {
  const margin = options.margin ?? 12;
  const safeBottom = options.viewportHeight - (options.dockHeight ?? 58) - margin;
  const anchorIsVisible = options.anchor.top >= margin && options.anchor.bottom <= safeBottom;
  const anchorIsNearRequestedPosition = options.targetTop === undefined
    || Math.abs(options.anchor.top - options.targetTop) < 16;
  if (anchorIsVisible && anchorIsNearRequestedPosition) return 0;
  const visibleHeight = Math.max(0, safeBottom - margin);
  const defaultTop = margin + Math.max(0, (visibleHeight - (options.anchor.bottom - options.anchor.top)) / 2);
  const maxTargetTop = Math.max(margin, safeBottom - (options.anchor.bottom - options.anchor.top));
  const targetTop = Math.min(maxTargetTop, Math.max(margin, options.targetTop ?? defaultTop));
  return options.anchor.top - targetTop;
}
