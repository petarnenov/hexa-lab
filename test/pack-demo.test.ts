// Pack tests (STORY-1.9, SUB-1.9.2.3).
//
// `npm run pack` is the delivery: one hexa.tar.gz, everything under hexa/,
// no node_modules. The script is run as a child process, exactly as npm
// would run it, with the output path pointed at a temp directory so a test
// run never leaves an archive in the repo. The archive is then read back
// with a small ustar reader written here - the format is 512-byte headers,
// name/prefix/size at fixed offsets, content padded to 512 - which checks the
// magic and the checksum of every header, so a writer that gets an offset
// wrong is caught rather than mirrored.
//
// `describe` matches the pack requirement in openspec/specs/project-toolchain.
import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const SCRIPT = fileURLToPath(new URL("../scripts/pack-demo.ts", import.meta.url));
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const BLOCK = 512;

/** Runs the pack script to `out`; resolves with its stderr. */
function pack(out: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, ["--import", "tsx", SCRIPT, out], { cwd: ROOT }, (error, _stdout, stderr) => {
      if (error) reject(new Error(`pack failed: ${error.message}\n${stderr}`));
      else resolve(stderr);
    });
  });
}

/** Reads a fixed-width field as a trimmed ASCII string. */
const field = (block: Buffer, offset: number, length: number): string =>
  block.subarray(offset, offset + length).toString("ascii").replace(/\0.*$/s, "").trim();

/** Every entry name in a .tar.gz, verifying the magic and checksum of each header. */
function entryNames(targz: Buffer): string[] {
  const tar = gunzipSync(targz);
  const names: string[] = [];
  for (let at = 0; at + BLOCK <= tar.length; ) {
    const header = tar.subarray(at, at + BLOCK);
    if (header.every((b) => b === 0)) break; // end-of-archive zero block
    assert.equal(field(header, 257, 6), "ustar", `bad magic at offset ${at}`);
    // The checksum is the sum of all header bytes with the checksum field itself read as spaces.
    let sum = 0;
    for (let i = 0; i < BLOCK; i++) sum += i >= 148 && i < 156 ? 0x20 : header[i]!;
    assert.equal(parseInt(field(header, 148, 8), 8), sum, `bad checksum at offset ${at}`);
    const name = field(header, 0, 100);
    const prefix = field(header, 345, 155);
    names.push(prefix ? `${prefix}/${name}` : name);
    const size = parseInt(field(header, 124, 12), 8);
    at += BLOCK + Math.ceil(size / BLOCK) * BLOCK;
  }
  return names;
}

describe("pack-demo", () => {
  let dir: string;
  let names: string[];
  let stderr: string;

  after(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  test("the script writes a readable archive and says so on stderr", async () => {
    dir = await mkdtemp(join(tmpdir(), "hexa-pack-"));
    const out = join(dir, "hexa.tar.gz");
    stderr = await pack(out);
    names = entryNames(await readFile(out));
    assert.match(stderr, /\[pack\] wrote /);
    assert.ok(names.length > 0, "archive is empty");
  });

  test("every entry is under the hexa/ prefix", () => {
    const outside = names.filter((n) => !n.startsWith("hexa/"));
    assert.deepEqual(outside, []);
  });

  test("node_modules and .git are not in the archive", () => {
    const cruft = names.filter((n) => n.includes("/node_modules/") || n.includes("/.git/"));
    assert.deepEqual(cruft, []);
  });

  test("files .gitignore excludes are not in the archive", () => {
    // session-report-*.html exists in the repo root while this runs (a plugin writes it).
    const ignored = names.filter((n) => /\/session-report-.*\.html$/.test(n) || /\.(bak|log|tsbuildinfo)$/.test(n));
    assert.deepEqual(ignored, []);
  });

  test("the project files are in the archive", () => {
    for (const expected of [
      "hexa/README.md",
      "hexa/package.json",
      "hexa/src/bootstrap/compose.ts",
      "hexa/data/accounts.json",
      "hexa/test/architecture.test.ts",
    ]) {
      assert.ok(names.includes(expected), `missing ${expected}`);
    }
  });

  test("packing again overwrites and never includes a previous archive", async () => {
    // Pack to the repo's own default location name inside the temp dir twice:
    // the second run must not pick up the first run's output.
    const out = join(dir, "hexa.tar.gz");
    await pack(out);
    const again = entryNames(await readFile(out));
    assert.deepEqual(again, names);
    assert.ok(!again.includes("hexa/hexa.tar.gz"), "archive contains itself");
  });
});
