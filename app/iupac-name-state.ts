export type IupacNameStatus = "loading" | "success" | "external-unlocalized" | "unsupported" | "external-error" | "error";

export type IupacNameResolution = {
  status: IupacNameStatus;
  name?: string;
};

/** Resolve the visible status from the local naming engine and the external
 * identity lookup. A local rejection is provisional while that lookup is active. */
export function resolveIupacNameState(input: {
  localStatus: "success" | "unsupported" | "error";
  localName?: string;
  externalStatus: "idle" | "loading" | "success" | "unlocalized" | "unsupported" | "error";
  externalName?: string;
}): IupacNameResolution {
  if (input.localStatus === "error") return { status: "error" };
  if (input.localStatus === "success" && input.localName) {
    return { status: "success", name: input.localName };
  }
  if (input.externalStatus === "success" && input.externalName) {
    return { status: "success", name: input.externalName };
  }
  if (input.externalStatus === "unlocalized" && input.externalName) {
    return { status: "external-unlocalized", name: input.externalName };
  }
  if (input.externalStatus === "error") return { status: "external-error" };
  if (input.externalStatus === "loading") return { status: "loading" };
  return { status: "unsupported" };
}
