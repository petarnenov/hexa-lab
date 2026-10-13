// Architecture test (STORY-1.5, TASK-1.5.3).
//
// The hexagon's dependency rule - domain knows nothing, application knows
// domain, adapters know both, bootstrap knows everything - is only real if a
// test enforces it. This file reads every .ts file under src/, extracts its
// imports with a small regex parser, maps source and target to a layer and
// checks the pair against a rule table. No tooling, no dependencies: the whole
// guard is a few pure functions plus a walk over the file system.
//
// The parser and the rule check are also tested on synthetic input so the
// guard cannot pass "by accident" when the parser is broken.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { posix } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// 1. Import parser (SUB-1.5.3.1)
// ---------------------------------------------------------------------------

// Drops /* block */ and // line comments so an import mentioned in prose is
// not counted. Naive on purpose: a string literal containing "//" would lose
// its tail. src/ has none; if one appears, extend this to skip string
// literals rather than loosening the regexes below.
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

// One regex per import form. Each captures the module specifier in single or
// double quotes. Type-only imports are matched too - on purpose: a domain
// file that knows the *type* of a port already depends on application.
const IMPORT_FORMS: readonly RegExp[] = [
  // import x from "m" / import { a } from "m" / import * as ns from "m" / import type { T } from "m"
  /\bimport\s+[^"'()]*?\s+from\s*["']([^"']+)["']/g,
  // export * from "m" / export { a } from "m" / export type { T } from "m"
  /\bexport\s+[^"'()]*?\s+from\s*["']([^"']+)["']/g,
  // side-effect import "m"
  /\bimport\s*["']([^"']+)["']/g,
  // dynamic import("m")
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
];

// Every module specifier imported by `source`, in order of appearance.
function importSpecifiers(source: string): string[] {
  const code = stripComments(source);
  const found: { index: number; specifier: string }[] = [];
  for (const form of IMPORT_FORMS) {
    for (const match of code.matchAll(form)) {
      found.push({ index: match.index, specifier: match[1]! });
    }
  }
  return found.sort((a, b) => a.index - b.index).map((f) => f.specifier);
}

// ---------------------------------------------------------------------------
// 2. Layers and the rule table (SUB-1.5.3.2)
// ---------------------------------------------------------------------------

type Layer = "domain" | "application" | "adapters/in" | "adapters/out" | "bootstrap";

// A target is a layer, or "external" for anything that is not a relative
// path (node: built-ins, packages).
type Target = Layer | "external";

// One import edge: `file` is repo-relative ("src/domain/x.ts"), `specifier`
// is the raw string from the import statement.
type Dependency = { file: string; specifier: string };

type Violation = Dependency & { message: string };

// The dependency rule from openspec/config.yaml, written down as data. Read a
// row as "<layer> may import <set>". Note what is NOT here: adapters/in and
// adapters/out never import each other, and one adapter never imports another
// adapter in the same direction - anything two adapters share belongs in
// domain/ or behind a port. Only adapters and bootstrap may touch the outside
// world (node:*), which is how domain and application stay pure.
const ALLOWED: Record<Layer, ReadonlySet<Target>> = {
  domain: new Set(["domain"]),
  application: new Set(["domain", "application"]),
  "adapters/in": new Set(["domain", "application", "external"]),
  "adapters/out": new Set(["domain", "application", "external"]),
  bootstrap: new Set(["domain", "application", "adapters/in", "adapters/out", "bootstrap", "external"]),
};

const SRC = "src";

// Layer of a path relative to src/, or undefined if it is in none of them.
function layerOf(pathFromSrc: string): Layer | undefined {
  const [first, second] = pathFromSrc.split("/");
  if (first === "adapters") {
    return second === "in" || second === "out" ? `adapters/${second}` : undefined;
  }
  return first === "domain" || first === "application" || first === "bootstrap" ? first : undefined;
}

const isRelative = (specifier: string) => specifier.startsWith("./") || specifier.startsWith("../");

// Resolves a relative specifier against the importing file and returns the
// target path relative to src/, or undefined when it leaves src/. Always
// posix: the paths we compare are our own, not the OS's.
function resolveFromSrc(fileFromSrc: string, specifier: string): string | undefined {
  const target = posix.normalize(posix.join(posix.dirname(fileFromSrc), specifier));
  return target.startsWith("../") || target === ".." ? undefined : target;
}

// Checks every edge against ALLOWED and returns the offending ones with a
// human-readable message each. Pure: takes edges, not files, so the self-test
// can feed it synthetic input.
function violationsOf(deps: readonly Dependency[]): Violation[] {
  const violations: Violation[] = [];
  for (const dep of deps) {
    const message = ruleMessage(dep);
    if (message !== undefined) violations.push({ ...dep, message });
  }
  return violations;
}

function ruleMessage({ file, specifier }: Dependency): string | undefined {
  const fileFromSrc = posix.relative(SRC, file);
  const from = layerOf(fileFromSrc);
  if (from === undefined) return `${file}: not in any layer (expected ${Object.keys(ALLOWED).join(", ")})`;

  let target: Target;
  let targetLabel: string;
  if (isRelative(specifier)) {
    const resolved = resolveFromSrc(fileFromSrc, specifier);
    if (resolved === undefined) return `${file} -> ${specifier}: import leaves ${SRC}/`;
    const to = layerOf(resolved);
    if (to === undefined) return `${file} -> ${specifier}: target ${resolved} is not in any layer`;
    target = to;
    targetLabel = to;
  } else {
    target = "external";
    targetLabel = `external module ${specifier}`;
  }

  return ALLOWED[from].has(target)
    ? undefined
    : `${file} -> ${specifier}: ${from} may not import ${targetLabel}`;
}

// ---------------------------------------------------------------------------
// 3. Walking src/ (SUB-1.5.3.2 / SUB-1.5.3.3)
// ---------------------------------------------------------------------------

// Every .ts file under `dir`, as repo-relative posix paths, sorted for stable
// output. Synchronous on purpose: the tree is tiny and sync code reads better
// for a guard like this. Declaration and test files are skipped - src/ has
// none today, but the rule is cheap.
function tsFilesUnder(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = posix.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...tsFilesUnder(full));
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts") && !entry.name.endsWith(".test.ts")) {
      files.push(full);
    }
  }
  return files.sort();
}

// All import edges in src/, resolved relative to the repo root so the paths
// in messages are the ones a developer would open.
function dependenciesIn(dir: string): Dependency[] {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const deps: Dependency[] = [];
  for (const file of tsFilesUnder(posix.join(root, dir))) {
    const source = readFileSync(file, "utf8");
    const repoRelative = posix.relative(root, file);
    for (const specifier of importSpecifiers(source)) deps.push({ file: repoRelative, specifier });
  }
  return deps;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("architecture-dependency-rule", () => {
  describe("import parser", () => {
    test("finds all five import forms and ignores commented-out ones", () => {
      const source = `
        import { a } from "./a.ts";
        export * from './b.ts';
        import "./c.ts";
        const d = await import("./d.ts");
        import type { T } from "./t.ts";
        // import { z } from "./z.ts"
        /* import "./w.ts" */
        /*
         * export { y } from "./y.ts"
         */
      `;
      assert.deepEqual(importSpecifiers(source), ["./a.ts", "./b.ts", "./c.ts", "./d.ts", "./t.ts"]);
    });

    test("an empty or import-free source yields nothing", () => {
      assert.deepEqual(importSpecifiers(""), []);
      assert.deepEqual(importSpecifiers("export const x = 1;"), []);
    });
  });

  describe("layers", () => {
    test("the first path segment names the layer, adapters need two", () => {
      assert.equal(layerOf("domain/Account.ts"), "domain");
      assert.equal(layerOf("application/ports/out/AccountRepository.ts"), "application");
      assert.equal(layerOf("adapters/in/http.ts"), "adapters/in");
      assert.equal(layerOf("adapters/out/memory.ts"), "adapters/out");
      assert.equal(layerOf("bootstrap/compose.ts"), "bootstrap");
    });

    test("a path outside the five layers has no layer", () => {
      assert.equal(layerOf("util/helpers.ts"), undefined);
      assert.equal(layerOf("adapters/shared.ts"), undefined);
      assert.equal(layerOf("index.ts"), undefined);
    });
  });

  describe("rule table", () => {
    const one = (file: string, specifier: string) => violationsOf([{ file, specifier }]);

    test("domain reaching into adapters/out is reported with both layers named", () => {
      const violations = one("src/domain/x.ts", "../adapters/out/y.ts");
      assert.equal(violations.length, 1);
      const [v] = violations;
      assert.equal(v!.file, "src/domain/x.ts");
      assert.equal(v!.specifier, "../adapters/out/y.ts");
      assert.match(v!.message, /src\/domain\/x\.ts/);
      assert.match(v!.message, /\.\.\/adapters\/out\/y\.ts/);
      assert.match(v!.message, /\bdomain\b/);
      assert.match(v!.message, /adapters\/out/);
    });

    test("a driving adapter may not import a driven adapter", () => {
      const [v] = one("src/adapters/in/a.ts", "../out/b.ts");
      assert.ok(v);
      assert.match(v.message, /adapters\/in/);
      assert.match(v.message, /adapters\/out/);
    });

    test("domain may not import node built-ins", () => {
      const [v] = one("src/domain/x.ts", "node:fs/promises");
      assert.ok(v);
      assert.match(v.message, /node:fs\/promises/);
      assert.match(v.message, /\bdomain\b/);
    });

    test("application may not import node built-ins either", () => {
      assert.equal(one("src/application/Service.ts", "node:fs").length, 1);
    });

    test("a file outside every layer is itself a violation", () => {
      const [v] = one("src/util/h.ts", "./x.ts");
      assert.ok(v);
      assert.match(v.message, /src\/util\/h\.ts/);
      assert.match(v.message, /not in any layer/);
    });

    test("an import that escapes src/ is a violation", () => {
      assert.equal(one("src/domain/x.ts", "../../test/helper.ts").length, 1);
    });

    test("allowed pairs produce no violations", () => {
      assert.deepEqual(
        violationsOf([
          { file: "src/domain/tieredFee.ts", specifier: "./FeeSchedule.ts" },
          { file: "src/application/Service.ts", specifier: "../domain/Account.ts" },
          { file: "src/application/Service.ts", specifier: "./ports/in/CalculateHouseholdFees.ts" },
          { file: "src/application/ports/out/AccountRepository.ts", specifier: "../../../domain/Account.ts" },
          { file: "src/adapters/in/cli.ts", specifier: "../../application/ports/in/CalculateHouseholdFees.ts" },
          { file: "src/adapters/in/http.ts", specifier: "node:http" },
          { file: "src/adapters/out/JsonFileAccountRepository.ts", specifier: "../../application/ports/out/AccountRepository.ts" },
          { file: "src/adapters/out/JsonFileAccountRepository.ts", specifier: "node:fs/promises" },
          { file: "src/bootstrap/compose.ts", specifier: "../adapters/in/cli.ts" },
          { file: "src/bootstrap/compose.ts", specifier: "../adapters/out/memory.ts" },
          { file: "src/bootstrap/compose.ts", specifier: "../application/Service.ts" },
          { file: "src/bootstrap/cli.main.ts", specifier: "./compose.ts" },
          { file: "src/bootstrap/cli.main.ts", specifier: "node:process" },
        ]),
        [],
      );
    });
  });

  describe("src/", () => {
    const deps = dependenciesIn(SRC);

    test("src/ obeys the dependency rule", () => {
      // One assertion for all violations: when the rule breaks, the developer
      // sees every offending edge at once, one line each.
      const violations = violationsOf(deps);
      assert.deepEqual(
        violations,
        [],
        `dependency rule violated:\n  ${violations.map((v) => v.message).join("\n  ")}`,
      );
    });

    test("src/ has at least one import", () => {
      // A broken parser finds no imports, hence no violations, hence a green
      // test that guards nothing. This keeps the test above honest.
      assert.ok(deps.length > 0, "no imports found in src/ - is the parser broken?");
    });
  });
});
