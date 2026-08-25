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

  it("documents controller authentication without baking its password into the image", () => {
    const envExample = rootFile(".env.example");
    const dockerfile = rootFile("Dockerfile");

    expect(envExample).toMatch(/^CONTROL_PASSWORD=$/m);
    expect(dockerfile).not.toContain("CONTROL_PASSWORD");
  });

  it("builds and runs the production image from Compose", () => {
    const compose = rootFile("compose.yml");

    expect(compose).toMatch(/build:\s*\n\s+context:\s*\./);
    expect(compose).toMatch(/dockerfile:\s*Dockerfile/);
    expect(compose).not.toContain("ghcr.io/pnpm/pnpm");
    expect(compose).not.toContain(".:/app");
    expect(compose).not.toContain("pnpm build && pnpm start");
    expect(compose).not.toMatch(/CONTROL_PASSWORD\s*=/);
    expect(compose).toContain('"127.0.0.1:4321:4321"');
  });

  it("keeps the relocated audio catalog available to both Docker stages", () => {
    const dockerfile = rootFile("Dockerfile");
    const dockerignore = rootFile(".dockerignore");

    expect(dockerfile).toContain(
      "COPY assets/sonidos/audios.json ./assets/sonidos/audios.json",
    );
    expect(dockerfile).toContain(
      "COPY --from=build --chown=node:node /app/assets/sonidos/audios.json ./assets/sonidos/audios.json",
    );
    expect(dockerignore).toMatch(/^!assets\/sonidos\/$/m);
    expect(dockerignore).toMatch(/^!assets\/sonidos\/audios\.json$/m);
  });

  it("uses the relocated audio workspace consistently", () => {
    const packageJson = JSON.parse(rootFile("package.json"));

    expect(packageJson.scripts.audios).toContain("assets/sonidos/generate.mjs");
    expect(packageJson.scripts["audios:install"]).toContain(
      "assets/sonidos/audios/*.mp3",
    );
    expect(packageJson.scripts["audios:durations"]).toContain(
      "assets/sonidos/durations.mjs",
    );
  });
});
