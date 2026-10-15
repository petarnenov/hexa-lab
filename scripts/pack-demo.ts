// pack-demo - `npm run pack`: the whole project as one hexa.tar.gz, without
// node_modules, every entry under a hexa/ prefix.
//
//   tsx scripts/pack-demo.ts [outFile]      default: <repo>/hexa.tar.gz
//
// Written in plain Node on purpose. `tar -czf` would work on both macOS and
// Linux, but the flag that adds a prefix is `--transform` on GNU tar and
// `-s` on BSD tar, and the project's rule (openspec/specs/project-toolchain)
// is that npm scripts use only node, npm and the dev dependencies.
// `git archive --prefix=hexa/` is portable but archives the last commit, not
// the working tree. So this file is a tar writer: the ustar format is one
// 512-byte header per file, the content padded to 512, two zero blocks at
// the end, and gzip from node:zlib on top. ~40 lines, and the reader sees
// exactly why node_modules is not in the archive: because we chose which
// files go in.
//
// This lives in scripts/, not src/: it is not part of the hexagon and has no
// layer, so test/architecture.test.ts (which walks only src/) ignores it.
// tsconfig.json includes scripts/ so `npm run typecheck` still covers it.

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { posix } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PREFIX = "hexa";
const BLOCK = 512;

const outFile = resolve(process.argv[2] ?? join(ROOT, "hexa.tar.gz"));

// What stays out. Mirrors .gitignore - when one changes, change the other.
// The output file itself is excluded by path so that `npm run pack` twice
// does not nest the first archive inside the second.
// Directories excluded wherever they appear (so ui/node_modules too):
const EXCLUDED_DIRS = new Set([".git", "node_modules"]);
// Directories excluded by repo-relative path, the way .gitignore lists them:
const EXCLUDED_PATHS = new Set(["ui/dist"]);
const EXCLUDED_FILES = new Set([".DS_Store"]);
// Files excluded by repo-relative path: the report log PUBLISHER=txt appends to by default.
const EXCLUDED_FILE_PATHS = new Set(["data/fee-reports.txt"]);
const EXCLUDED_SUFFIXES = [".bak", ".tsbuildinfo", ".log", ".tar.gz"];
// `session-report-*.html` in .gitignore: usage reports a Claude Code plugin drops in the repo root.
const isSessionReport = (name: string) => name.startsWith("session-report-") && name.endsWith(".html");

function isExcludedFile(name: string, absolute: string): boolean {
  return (
    absolute === outFile ||
    EXCLUDED_FILES.has(name) ||
    EXCLUDED_SUFFIXES.some((s) => name.endsWith(s)) ||
    isSessionReport(name)
  );
}

/** Every file under `dir`, repo-relative with posix separators, sorted so the archive is stable. */
function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const absolute = join(dir, entry.name);
    const repoPath = relative(ROOT, absolute).split("\\").join("/");
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name) && !EXCLUDED_PATHS.has(repoPath)) files.push(...walk(absolute));
    } else if (entry.isFile() && !isExcludedFile(entry.name, absolute) && !EXCLUDED_FILE_PATHS.has(repoPath)) {
      files.push(repoPath);
    }
  }
  return files;
}

/** Writes an ASCII field into the header, NUL-padded. */
function put(header: Buffer, offset: number, length: number, value: string): void {
  header.write(value, offset, length, "ascii");
}

/** Octal fields are `length - 1` digits, zero-padded, then a NUL. */
const octal = (n: number, length: number) => n.toString(8).padStart(length - 1, "0") + "\0";

/**
 * Splits a path into the ustar `name` (<= 100) and `prefix` (<= 155) fields.
 * Short paths fit in `name` alone; longer ones break at a `/` so that both
 * halves fit. If no split works the path is too long for ustar - fail
 * loudly with the path, never truncate.
 */
function splitName(path: string): { name: string; prefix: string } {
  if (path.length <= 100) return { name: path, prefix: "" };
  for (let i = path.lastIndexOf("/"); i > 0; i = path.lastIndexOf("/", i - 1)) {
    const prefix = path.slice(0, i);
    const name = path.slice(i + 1);
    if (prefix.length <= 155 && name.length <= 100) return { name, prefix };
  }
  throw new Error(`path too long for ustar: ${path}`);
}

/** One ustar header block for a regular file. */
function header(path: string, size: number, mode: number, mtime: number): Buffer {
  const block = Buffer.alloc(BLOCK);
  const { name, prefix } = splitName(path);
  put(block, 0, 100, name);
  put(block, 100, 8, octal(mode, 8));
  put(block, 108, 8, octal(0, 8)); // uid
  put(block, 116, 8, octal(0, 8)); // gid
  put(block, 124, 12, octal(size, 12));
  put(block, 136, 12, octal(mtime, 12));
  put(block, 148, 8, "        "); // checksum placeholder: eight spaces
  put(block, 156, 1, "0"); // typeflag: regular file
  put(block, 257, 6, "ustar\0");
  put(block, 263, 2, "00");
  put(block, 265, 32, PREFIX); // uname
  put(block, 297, 32, PREFIX); // gname
  put(block, 345, 155, prefix);
  // The checksum is the byte sum of the header with the checksum field as spaces:
  // six octal digits, a NUL and a space.
  let sum = 0;
  for (const byte of block) sum += byte;
  put(block, 148, 8, sum.toString(8).padStart(6, "0") + "\0 ");
  return block;
}

const files = walk(ROOT);
const parts: Buffer[] = [];
for (const file of files) {
  const absolute = join(ROOT, file);
  const stat = statSync(absolute);
  const content = readFileSync(absolute);
  const executable = (stat.mode & 0o111) !== 0;
  parts.push(header(posix.join(PREFIX, file), content.length, executable ? 0o755 : 0o644, Math.floor(stat.mtimeMs / 1000)));
  parts.push(content);
  const padding = (BLOCK - (content.length % BLOCK)) % BLOCK;
  if (padding > 0) parts.push(Buffer.alloc(padding));
}
parts.push(Buffer.alloc(BLOCK * 2)); // end of archive

writeFileSync(outFile, gzipSync(Buffer.concat(parts)));
process.stderr.write(`[pack] wrote ${outFile} (${files.length} files)\n`);
