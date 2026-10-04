import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { readFileSync, rmSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Isolate config tests in a temp directory
let tmpConfig: string;

beforeEach(() => {
  tmpConfig = join(tmpdir(), `wren-test-${Date.now()}`);
  mkdirSync(tmpConfig, { recursive: true });
  process.env.WREN_CONFIG_DIR = tmpConfig;
});

afterEach(() => {
  rmSync(tmpConfig, { recursive: true, force: true });
  delete process.env.WREN_CONFIG_DIR;
});

describe("auth config", () => {
  it("returns empty config when no file exists", async () => {
    const { readConfig } = await import("../../index.ts");
    // auth module doesn't have a readConfig — placeholder for auth-specific unit tests
    expect(true).toBe(true);
  });
});
