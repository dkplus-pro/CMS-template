import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const pageSource = await readFile(new URL("../src/routes/page.tsx", import.meta.url), "utf8");
const layoutSource = await readFile(new URL("../src/routes/layout.tsx", import.meta.url), "utf8");
const configSource = await readFile(new URL("../modern.config.ts", import.meta.url), "utf8");

test("admin app exposes standard lifecycle scripts", () => {
  assert.equal(packageJson.scripts.dev, "modern dev");
  assert.equal(packageJson.scripts.build, "modern build");
  assert.equal(packageJson.scripts["build:github-pages"], "modern build");
  assert.equal(packageJson.scripts["deploy:github-pages"], "pnpm --workspace-root run build:pages");
  assert.equal(packageJson.scripts.typecheck, "tsc --noEmit");
});

test("admin app has visible hello-world content and Modern.js app tools configured", () => {
  assert.match(pageSource, /Hello from the admin app/);
  assert.match(layoutSource, /Outlet/);
  assert.match(configSource, /appTools\(\)/);
});

test("admin app config supports repository-scoped GitHub Pages paths", () => {
  assert.match(configSource, /GITHUB_PAGES_BASE_PATH/);
  assert.match(configSource, /GITHUB_REPOSITORY/);
  assert.match(configSource, /assetPrefix: githubPagesBasePath/);
  assert.match(configSource, /server: { port: devServerPort }/);
  assert.match(configSource, /outputStructure: "flat"/);
  assert.match(configSource, /html: ""/);
});

test("stage 0 wires openapi contract pipeline and dev proxy to the go server", async () => {
  assert.equal(packageJson.scripts["gen:api"], "orval --config ./orval.config.ts");

  const clientSource = await readFile(new URL("../src/api/client.ts", import.meta.url), "utf8");
  assert.match(clientSource, /BASE_URL/);
  assert.match(clientSource, /Authorization/);
  assert.match(clientSource, /export function customInstance/);
  assert.match(clientSource, /Axios\.create/);

  const configSource = await readFile(new URL("../modern.config.ts", import.meta.url), "utf8");
  assert.match(configSource, /proxy: \{/);
  assert.match(configSource, /target: "http:\/\/localhost:8080"/);
  assert.match(configSource, /pathRewrite: \{ "\^\/api": "" \}/);

  const generatedHealthz = await readFile(
    new URL("../src/api/generated/system/system.ts", import.meta.url),
    "utf8"
  );
  assert.match(generatedHealthz, /export const getSystem/);
  assert.match(generatedHealthz, /customInstance<HealthzResponse>/);
});
