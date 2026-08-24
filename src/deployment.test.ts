import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rootFile = (name: string) =>
  readFileSync(new URL(`../${name}`, import.meta.url), "utf8");

describe("production container", () => {
  it("builds Astro in a dedicated stage and installs only runtime dependencies", () => {
    const dockerfile = rootFile("Dockerfile");

    expect(dockerfile).toMatch(/FROM node:24-alpine AS base/);
    expect(dockerfile).toMatch(/FROM base AS build/);
    expect(dockerfile).toMatch(/RUN pnpm build/);
    expect(dockerfile).toMatch(/FROM base AS runtime/);
    expect(dockerfile).toMatch(/pnpm install --prod --frozen-lockfile/);
  });

  it("runs the custom HTTP and WebSocket server as a non-root user", () => {
    const dockerfile = rootFile("Dockerfile");

    expect(dockerfile).toMatch(/ENV HOST=0\.0\.0\.0/);
    expect(dockerfile).toMatch(/ENV PORT=4321/);
    expect(dockerfile).toMatch(/EXPOSE 4321/);
    expect(dockerfile).toMatch(/USER node/);
    expect(dockerfile).toMatch(/HEALTHCHECK/);
    expect(dockerfile).toContain(
      'CMD ["./node_modules/.bin/tsx", "./server.mjs"]',
    );
    expect(dockerfile).not.toContain('CMD ["pnpm", "start"]');
  });

  it("keeps the TypeScript runtime and secrets out of the build context", () => {
    const packageJson = JSON.parse(rootFile("package.json"));
    const dockerignore = rootFile(".dockerignore");

    expect(packageJson.dependencies.tsx).toBeDefined();
    expect(packageJson.devDependencies?.tsx).toBeUndefined();
    expect(dockerignore).toMatch(/^\.env$/m);
    expect(dockerignore).toMatch(/^\.git$/m);
    expect(dockerignore).toMatch(/^node_modules$/m);
    expect(dockerignore).toMatch(/^dist$/m);
  });

  it("uses injected environment variables when no local .env file exists", () => {
    const server = rootFile("server.mjs");

    expect(server).not.toContain("loadEnvFile");
    expect(server).toMatch(/process\.env\.PORT \?\? 4321/);
    expect(server).toMatch(/process\.env\.HOST \?\? "0\.0\.0\.0"/);
  });
});
