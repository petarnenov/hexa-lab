// README tests (STORY-1.9, TASK-1.9.1).
//
// The README is part of the deliverable, so it is checked like code. The
// checks are on *content* - strings that must appear - never on headings or
// order, so the document can be reorganised freely without touching this
// file. Each assertion is its own test: when something is missing the test
// name says what.
//
// `describe` matches the capability spec openspec/specs/project-readme,
// one `test` per thing the spec says the README must mention.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

/** Asserts that every string in `needles` appears in the README. */
const mentions = (...needles: string[]) => {
  for (const needle of needles) assert.ok(readme.includes(needle), `README.md does not mention "${needle}"`);
};

describe("project-readme", () => {
  test("README.md exists and is not empty", () => {
    assert.ok(readme.trim().length > 0, "README.md is empty");
  });

  test("names every layer folder of src/", () => {
    mentions("src/domain/", "src/application/", "src/adapters/in/", "src/adapters/out/", "src/bootstrap/");
  });

  test("names the test that guards the dependency rule", () => {
    mentions("test/architecture.test.ts");
  });

  test("gives the commands to install, test, typecheck and run", () => {
    mentions("npm install", "npm test", "npm run typecheck", "npm run cli", "npm run http");
  });

  test("explains the environment variables", () => {
    mentions("STORAGE=json", "DATA_DIR", "PORT");
  });

  test("shows the demo total and the not-found error", () => {
    mentions("14239.73", "HOUSEHOLD_NOT_FOUND");
  });

  test("links exactly five exercises, STORY-2.1 to STORY-2.5, once each", () => {
    const links = [...readme.matchAll(/backlog\/EPIC-2-exercises\/STORY-2\.([1-5])-[a-z-]+\/STORY-2\.\1\.md/g)];
    assert.deepEqual(
      links.map((m) => m[1]).sort(),
      ["1", "2", "3", "4", "5"],
      `expected one link per exercise, found: ${links.map((m) => m[0]).join(", ") || "none"}`,
    );
  });
});
