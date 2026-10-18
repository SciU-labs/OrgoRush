import { createHash } from "node:crypto";
import { CanonizerUtil, SmilesParser } from "openchemlib";
import { structuralIdentity } from "../../tests/helpers/reference-corpus.mjs";

export const sha256 = (body) => createHash("sha256").update(body).digest("hex");
export function evidenceMap(document) {
  const entries = new Map();
  for (const receipt of document.responses) {
    if (entries.has(receipt.name) || sha256(receipt.body) !== receipt.sha256
      || receipt.url !== `https://www.ebi.ac.uk/opsin/ws/${encodeURIComponent(receipt.name)}.json`) {
      throw new Error(`Corrupt or duplicate independent receipt: ${receipt.name}`);
    }
    JSON.parse(receipt.body);
    entries.set(receipt.name, receipt);
  }
  return entries;
}
export function interpretName(name, inputSmiles, receipts) {
  if (!name) return { status: "UNSUPPORTED" };
  const receipt = receipts.get(name);
  if (!receipt) return { status: "UNVERIFIED", reason: "No independent receipt for this exact English text" };
  const body = JSON.parse(receipt.body);
  const provenance = { name, receiptSha256: receipt.sha256, origin: receipt.origin, retrievedAt: receipt.retrievedAt };
  if (body.status === "FAILURE") return { status: "REJECTED", reason: body.message ?? "OPSIN could not interpret the exact text", ...provenance };
  if (receipt.httpStatus !== 200 || !["SUCCESS", "WARNING"].includes(body.status) || !body.smiles) {
    return { status: "UNVERIFIED", reason: "HTTP/service response is not a usable independent interpretation", ...provenance };
  }
  const match = structuralIdentity(body.smiles) === structuralIdentity(inputSmiles);
  const constitution = (smiles) => CanonizerUtil.getIDCode(new SmilesParser().parseMolecule(smiles), CanonizerUtil.NOSTEREO);
  const constitutionalMatch = constitution(body.smiles) === constitution(inputSmiles);
  return { status: match ? "MATCH" : "MISMATCH", constitutionalMatch,
    ...(match ? {} : { interpretedSmiles: body.smiles }), parserStatus: body.status, ...provenance };
}
