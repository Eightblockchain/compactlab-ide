/**
 * Compile every template's Compact source on the pinned compiler (no ZK keys).
 * Run: pnpm templates:check
 * Exits non-zero if any template fails, so it can act as a drift alarm.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { COMPACT_TEMPLATES } from "../lib/constants";
import { COMPACT_COMPILER_PACKAGE } from "../lib/version";

const compactBin = process.env.COMPACT_BIN ?? "compact";

function main() {
  const work = mkdtempSync(join(tmpdir(), "compactlab-templates-"));
  const failures: string[] = [];
  let compiled = 0;

  console.log(`=== compact compile +${COMPACT_COMPILER_PACKAGE} --skip-zk ===`);
  try {
    for (const [key, template] of Object.entries(COMPACT_TEMPLATES)) {
      const sources = template.files.filter((f) => f.language === "compact");
      if (sources.length === 0) {
        failures.push(`${key}: no .compact file`);
        console.error(`FAIL ${key}: no .compact file`);
        continue;
      }
      for (const file of sources) {
        const label = `${key}/${file.name}`;
        const dir = join(work, key);
        mkdirSync(dir, { recursive: true });
        const input = join(dir, file.name);
        writeFileSync(input, file.content);
        const started = Date.now();
        const result = spawnSync(
          compactBin,
          ["compile", `+${COMPACT_COMPILER_PACKAGE}`, "--skip-zk", input, join(dir, "out")],
          { encoding: "utf8" },
        );
        const secs = ((Date.now() - started) / 1000).toFixed(1);
        if (result.error || result.status !== 0) {
          const detail = (result.error?.message ?? `${result.stderr}${result.stdout}`).trim();
          failures.push(label);
          console.error(`FAIL ${label} (${secs}s)\n${detail}\n`);
        } else {
          compiled += 1;
          console.log(`ok ${label} (${secs}s)`);
        }
      }
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }

  console.log(`\n${compiled} compiled, ${failures.length} failed`);
  if (failures.length > 0) {
    console.error(`failed: ${failures.join(", ")}`);
    process.exit(1);
  }
}

main();
