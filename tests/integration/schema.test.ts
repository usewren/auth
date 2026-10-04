import { describe, it, expect } from "bun:test";
import pg from "pg";

const TEST_DB = process.env.DATABASE_URL ?? "postgres://wren:wren@localhost:5432/wren_test";

describe("auth schema", () => {
  it("user table exists with required columns", async () => {
    const client = new pg.Client({ connectionString: TEST_DB });
    await client.connect();

    const res = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'user'
    `);

    const cols = res.rows.map(r => r.column_name);
    expect(cols).toContain("id");
    expect(cols).toContain("email");
    expect(cols).toContain("name");
    expect(cols).toContain("role");
    expect(cols).toContain("org_id");

    await client.end();
  });

  it("session table exists with required columns", async () => {
    const client = new pg.Client({ connectionString: TEST_DB });
    await client.connect();

    const res = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'session'
    `);

    const cols = res.rows.map(r => r.column_name);
    expect(cols).toContain("id");
    expect(cols).toContain("token");
    expect(cols).toContain("user_id");
    expect(cols).toContain("expires_at");

    await client.end();
  });
});
