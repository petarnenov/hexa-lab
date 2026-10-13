// Smoke test for the project toolchain (STORY-1.1).
//
// It proves three things at once:
//   1. `node --import tsx --test` can load and run a TypeScript test file;
//   2. `tsc --noEmit` has at least one input even while src/ is still empty;
//   3. the "no runtime dependencies" rule holds (see openspec/specs/project-toolchain).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

type PackageJson = {
  type?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
) as PackageJson;

test("package is an ES module", () => {
  assert.equal(packageJson.type, "module");
});

test("package has no runtime dependencies", () => {
  assert.deepEqual(packageJson.dependencies ?? {}, {});
});

test("only the three allowed dev dependencies are declared", () => {
  const allowed = ["@types/node", "tsx", "typescript"];
  assert.deepEqual(Object.keys(packageJson.devDependencies ?? {}).sort(), allowed);
});
