// Keep Worker declarations scoped to the server integration; importing all
// runtime globals would collide with the browser DOM used by the editor.
declare module "cloudflare:workers" {
  const env: import("./env.ts").WorkerEnv;
  export { env };
}
