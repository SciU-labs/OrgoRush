import react from "@vitejs/plugin-react";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import { createExerciseChemistryOracles } from "../../app/exercise-chemistry-oracles.ts";

// Reuse the production exports where they currently live; no fake chemistry or
// copied naming/valence rules. Loading is outside the pure generator invocation.
export async function loadExerciseChemistry() {
  const server = await createServer({
    root: fileURLToPath(new URL("../..", import.meta.url)),
    // Keep test-server cleanup away from the managed node_modules/.vite link.
    // On Windows Vite attempts to remove that junction when the server closes.
    cacheDir: fileURLToPath(new URL("../../node_modules/.vite-exercise-tests", import.meta.url)),
    configFile: false, logLevel: "error", appType: "custom", plugins: [react()],
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  try {
    const engine = await server.ssrLoadModule("/app/page.tsx");
    return { oracles: createExerciseChemistryOracles(engine), engine,
      loadModule: (path) => server.ssrLoadModule(path), close: () => server.close() };
  } catch (error) {
    await server.close();
    throw error;
  }
}
