import type { D1Database } from "@cloudflare/workers-types/2023-07-01";

/** Existing bindings consumed by the Sites entry point and lazy D1 access. */
export interface WorkerEnv {
  // Vinext's WorkerAssetEnv consumes the web-platform Request/Response
  // contract, rather than the package's standalone Worker fetch overloads.
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}
