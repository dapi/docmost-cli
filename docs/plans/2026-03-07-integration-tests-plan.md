# Integration Tests Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add end-to-end integration tests for all 11 command groups running against a live Docmost instance via docker-compose.

**Architecture:** Programmatic CLI runner (Commander.parseAsync) inside vitest, docker-compose for Docmost + PG + Redis, setup/teardown per test suite. Separate vitest config for integration tests.

**Tech Stack:** Vitest, Docker Compose, Commander.js programmatic execution

**Design doc:** `docs/plans/2026-03-07-integration-tests-design.md`

---

### Task 1: Docker Compose test environment

**Files:**
- Create: `docker-compose.test.yml`
- Create: `scripts/wait-for-docmost.sh`

**Step 1: Create docker-compose.test.yml**

```yaml
# docker-compose.test.yml
services:
  docmost:
    image: docmost/docmost:latest
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      APP_URL: http://localhost:4010
      APP_SECRET: test-secret-key-change-me-1234567890ab
      DATABASE_URL: postgresql://docmost:docmost@postgres:5432/docmost?schema=public
      REDIS_URL: redis://redis:6379
      PORT: "4010"
    ports:
      - "4010:4010"
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:4010/api/health"]
      interval: 5s
      timeout: 5s
      retries: 30
      start_period: 30s

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: docmost
      POSTGRES_USER: docmost
      POSTGRES_PASSWORD: docmost
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U docmost"]
      interval: 3s
      timeout: 3s
      retries: 10

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 3s
      timeout: 3s
      retries: 10
```

**Step 2: Create wait-for-docmost.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail

URL="${DOCMOST_TEST_URL:-http://localhost:4010}"
MAX_WAIT=120
WAITED=0

echo "Waiting for Docmost at $URL ..."

until curl -sf "$URL/api/health" > /dev/null 2>&1; do
  if [ "$WAITED" -ge "$MAX_WAIT" ]; then
    echo "ERROR: Docmost did not become healthy within ${MAX_WAIT}s"
    exit 1
  fi
  sleep 2
  WAITED=$((WAITED + 2))
  echo "  ... waiting (${WAITED}s)"
done

echo "Docmost is ready (${WAITED}s)"
```

```bash
chmod +x scripts/wait-for-docmost.sh
```

**Step 3: Commit**

```bash
git add docker-compose.test.yml scripts/wait-for-docmost.sh
git commit -m "chore: add docker-compose test environment and wait script"
```

---

### Task 2: Vitest integration config and npm scripts

**Files:**
- Create: `vitest.integration.config.ts`
- Modify: `package.json` (scripts section)
- Create: `.env.test.example`

**Step 1: Create vitest.integration.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/__tests__/integration/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    sequence: {
      concurrent: false,
    },
    globalSetup: ["src/__tests__/integration/helpers/global-setup.ts"],
  },
});
```

**Step 2: Create .env.test.example**

```
DOCMOST_TEST_URL=http://localhost:4010
DOCMOST_TEST_EMAIL=test@example.com
DOCMOST_TEST_PASSWORD=TestPassword123!
```

**Step 3: Add npm scripts to package.json**

Add to `"scripts"`:
```json
"test:integration": "vitest run --config vitest.integration.config.ts",
"test:all": "vitest run && vitest run --config vitest.integration.config.ts"
```

**Step 4: Commit**

```bash
git add vitest.integration.config.ts .env.test.example package.json
git commit -m "chore: add vitest integration config and npm scripts"
```

---

### Task 3: Programmatic CLI runner helper

**Files:**
- Create: `src/__tests__/integration/helpers/run-cli.ts`

**Step 1: Write run-cli.ts**

This is the core test utility. It imports the CLI program, intercepts stdout/stderr, and runs commands programmatically.

```typescript
import { readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { Command } from "commander";
import {
  normalizeError,
  printError,
  isCommanderHelpExit,
} from "../../../lib/cli-utils.js";

// Import all register functions
import { register as registerPageCommands } from "../../../commands/page.js";
import { register as registerWorkspaceCommands } from "../../../commands/workspace.js";
import { register as registerInviteCommands } from "../../../commands/invite.js";
import { register as registerUserCommands } from "../../../commands/user.js";
import { register as registerSpaceCommands } from "../../../commands/space.js";
import { register as registerGroupCommands } from "../../../commands/group.js";
import { register as registerCommentCommands } from "../../../commands/comment.js";
import { register as registerShareCommands } from "../../../commands/share.js";
import { register as registerFileCommands } from "../../../commands/file.js";
import { register as registerSearchCommands } from "../../../commands/search.js";
import { register as registerDiscoveryCommands } from "../../../commands/discovery.js";

export type CliResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

function buildProgram(): Command {
  const program = new Command()
    .name("docmost")
    .exitOverride()
    .configureOutput({
      writeOut: () => {},
      writeErr: () => {},
    });

  // Global options matching src/index.ts
  program
    .option("-u, --api-url <url>", "Docmost API URL")
    .option("-e, --email <email>", "Docmost account email")
    .option("--password <password>", "Docmost account password")
    .option("-t, --token <token>", "Docmost API auth token")
    .option("-f, --format <format>", "Output format: json | table | text", "json")
    .option("-q, --quiet", "Suppress output, exit code only")
    .option("--limit <n>", "Items per API page (1-100)")
    .option("--max-items <n>", "Stop after N total items");

  registerPageCommands(program);
  registerWorkspaceCommands(program);
  registerInviteCommands(program);
  registerUserCommands(program);
  registerSpaceCommands(program);
  registerGroupCommands(program);
  registerCommentCommands(program);
  registerShareCommands(program);
  registerFileCommands(program);
  registerSearchCommands(program);
  registerDiscoveryCommands(program);

  return program;
}

/**
 * Run a CLI command programmatically and capture output.
 *
 * @param args - CLI arguments (e.g., ["page-list", "--space-id", "abc"])
 * @param env  - Extra env vars for this invocation
 */
export async function runCli(
  args: string[],
  env: Record<string, string> = {},
): Promise<CliResult> {
  const stdout: string[] = [];
  const stderr: string[] = [];

  // Save and override env
  const savedEnv: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) {
    savedEnv[k] = process.env[k];
    process.env[k] = v;
  }

  // Intercept console
  const origLog = console.log;
  const origError = console.error;
  const origTable = console.table;
  const origStdoutWrite = process.stdout.write;
  const origStderrWrite = process.stderr.write;

  console.log = (...a: unknown[]) => stdout.push(a.map(String).join(" "));
  console.error = (...a: unknown[]) => stderr.push(a.map(String).join(" "));
  console.table = (...a: unknown[]) => stdout.push(JSON.stringify(a));
  process.stdout.write = ((chunk: string) => {
    stdout.push(chunk);
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string) => {
    stderr.push(chunk);
    return true;
  }) as typeof process.stderr.write;

  let exitCode = 0;

  try {
    const program = buildProgram();
    await program.parseAsync(["node", "docmost", ...args]);
  } catch (error: unknown) {
    if (isCommanderHelpExit(error)) {
      exitCode = 0;
    } else {
      // Mirror src/index.ts error handling: normalize + print envelope
      const normalized = normalizeError(error);
      printError(normalized, "json");
      exitCode = normalized.exitCode;
    }
  } finally {
    // Restore
    console.log = origLog;
    console.error = origError;
    console.table = origTable;
    process.stdout.write = origStdoutWrite;
    process.stderr.write = origStderrWrite;
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }

  return {
    stdout: stdout.join("\n"),
    stderr: stderr.join("\n"),
    exitCode,
  };
}

/** Parse JSON envelope from stdout (success) or stderr (error) */
export function parseEnvelope(result: CliResult) {
  const source = result.stdout.trim() || result.stderr.trim();
  return JSON.parse(source);
}

/** Get test server URL from env */
export function testUrl(): string {
  return process.env.DOCMOST_TEST_URL || "http://localhost:4010";
}

/** Must match TOKEN_FILE in global-setup.ts (duplicated to avoid ESM import issues) */
const TOKEN_FILE = join(tmpdir(), "docmost-test-token");

/** Read token written by global-setup (runs in a separate process) */
function readTestToken(): string {
  try {
    return readFileSync(TOKEN_FILE, "utf-8").trim();
  } catch {
    return process.env.DOCMOST_TEST_TOKEN || "";
  }
}

/** Get test credentials env vars for runCli */
export function testEnv(): Record<string, string> {
  return {
    DOCMOST_API_URL: testUrl(),
    DOCMOST_TOKEN: readTestToken(),
    DOCMOST_EMAIL: process.env.DOCMOST_TEST_EMAIL || "",
    DOCMOST_PASSWORD: process.env.DOCMOST_TEST_PASSWORD || "",
  };
}
```

**Step 2: Commit**

```bash
git add src/__tests__/integration/helpers/run-cli.ts
git commit -m "feat(test): add programmatic CLI runner for integration tests"
```

---

### Task 4: Global setup — workspace bootstrap

**Files:**
- Create: `src/__tests__/integration/helpers/global-setup.ts`

Docmost requires initial setup (create first user + workspace) before API calls work. The global setup handles this.

**Step 1: Write global-setup.ts**

```typescript
import { writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import axios from "axios";

const BASE_URL = process.env.DOCMOST_TEST_URL || "http://localhost:4010";
const EMAIL = process.env.DOCMOST_TEST_EMAIL || "test@example.com";
const PASSWORD = process.env.DOCMOST_TEST_PASSWORD || "TestPassword123!";
const WORKSPACE_NAME = "CLI Integration Tests";

/** Shared file path for token — globalSetup runs in a separate process,
 *  so process.env changes are NOT visible in test workers.
 *  We write the token to a file and read it in testEnv(). */
export const TOKEN_FILE = join(tmpdir(), "docmost-test-token");

export async function setup() {
  // Check if Docmost is reachable
  try {
    const health = await axios.get(`${BASE_URL}/api/health`);
    if (health.status !== 200) {
      throw new Error(`Docmost health check failed: ${health.status}`);
    }
  } catch (err) {
    throw new Error(
      `Cannot reach Docmost at ${BASE_URL}. Is docker-compose running?\n` +
        `Run: docker compose -f docker-compose.test.yml up -d`,
    );
  }

  // Try to setup workspace (first-run) or skip if already done
  try {
    await axios.post(`${BASE_URL}/api/auth/setup`, {
      workspaceName: WORKSPACE_NAME,
      name: "Test User",
      email: EMAIL,
      password: PASSWORD,
    });
    console.log("[global-setup] Created workspace and admin user");
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 400) {
      console.log("[global-setup] Workspace already exists, skipping setup");
    } else {
      throw err;
    }
  }

  // Login to get token
  const loginResp = await axios.post(`${BASE_URL}/api/auth/login`, {
    email: EMAIL,
    password: PASSWORD,
  });

  const token = loginResp.data?.token;
  if (!token) {
    throw new Error("Failed to obtain auth token from login response");
  }

  // Write token to shared file so test workers can read it
  writeFileSync(TOKEN_FILE, token, "utf-8");
  console.log("[global-setup] Obtained auth token, wrote to", TOKEN_FILE);
}

export async function teardown() {
  try { rmSync(TOKEN_FILE); } catch {}
}
```

**Step 2: Commit**

```bash
git add src/__tests__/integration/helpers/global-setup.ts
git commit -m "feat(test): add global setup — workspace bootstrap and auth"
```

---

### Task 5: Integration test — workspace commands

**Files:**
- Create: `src/__tests__/integration/workspace.test.ts`

**Step 1: Write the test**

```typescript
import { describe, it, expect } from "vitest";
import { runCli, parseEnvelope, testEnv } from "./helpers/run-cli.js";

const env = testEnv();

describe("workspace commands", () => {
  it("workspace-info returns workspace data", async () => {
    const result = await runCli(["workspace-info"], env);
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(envelope.data).toHaveProperty("name");
    expect(envelope.data).toHaveProperty("id");
  });

  it("workspace-public returns public info without auth", async () => {
    const result = await runCli(["workspace-public"], {
      DOCMOST_API_URL: env.DOCMOST_API_URL,
    });
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(envelope.data).toHaveProperty("name");
  });

  it("member-list returns array", async () => {
    const result = await runCli(["member-list"], env);
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(Array.isArray(envelope.data)).toBe(true);
    expect(envelope.meta).toHaveProperty("count");
  });

  it("workspace-info with invalid token returns AUTH_ERROR", async () => {
    const result = await runCli(["workspace-info"], {
      DOCMOST_API_URL: env.DOCMOST_API_URL,
      DOCMOST_TOKEN: "invalid-token-12345",
    });

    expect(result.exitCode).not.toBe(0);
    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe("AUTH_ERROR");
  });
});
```

**Step 2: Run test to verify**

```bash
npm run test:integration -- --reporter=verbose src/__tests__/integration/workspace.test.ts
```

Expected: PASS (3 tests)

**Step 3: Commit**

```bash
git add src/__tests__/integration/workspace.test.ts
git commit -m "test: add workspace integration tests"
```

---

### Task 6: Integration test — space commands (CRUD)

**Files:**
- Create: `src/__tests__/integration/space.test.ts`

**Step 1: Write the test**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runCli, parseEnvelope, testEnv } from "./helpers/run-cli.js";

const env = testEnv();

describe("space commands", () => {
  let spaceId: string;
  const spaceName = `test-space-${Date.now()}`;

  it("space-create creates a space", async () => {
    const result = await runCli(
      ["space-create", "--name", spaceName],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(envelope.data).toHaveProperty("id");
    expect(envelope.data.name).toBe(spaceName);
    spaceId = envelope.data.id;
  });

  it("space-list includes created space", async () => {
    expect(spaceId).toBeDefined(); // guard: depends on space-create
    const result = await runCli(["space-list"], env);
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    const names = envelope.data.map((s: any) => s.name);
    expect(names).toContain(spaceName);
  });

  it("space-info returns space details", async () => {
    expect(spaceId).toBeDefined(); // guard: depends on space-create
    const result = await runCli(
      ["space-info", "--space-id", spaceId],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.id).toBe(spaceId);
    expect(envelope.data.name).toBe(spaceName);
  });

  it("space-update changes name", async () => {
    expect(spaceId).toBeDefined(); // guard: depends on space-create
    const newName = `${spaceName}-updated`;
    const result = await runCli(
      ["space-update", "--space-id", spaceId, "--name", newName],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.name).toBe(newName);
  });

  it("space-info on non-existent ID returns error", async () => {
    const result = await runCli(
      ["space-info", "--space-id", "00000000-0000-0000-0000-000000000000"],
      env,
    );
    // Expect non-zero exit or error envelope
    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(false);
  });

  afterAll(async () => {
    if (spaceId) {
      await runCli(["space-delete", "--space-id", spaceId], env);
    }
  });
});
```

**Step 2: Run and verify**

```bash
npm run test:integration -- --reporter=verbose src/__tests__/integration/space.test.ts
```

**Step 3: Commit**

```bash
git add src/__tests__/integration/space.test.ts
git commit -m "test: add space CRUD integration tests"
```

---

### Task 7: Integration test — page commands (CRUD + advanced)

**Files:**
- Create: `src/__tests__/integration/page.test.ts`

**Step 1: Write the test**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runCli, parseEnvelope, testEnv } from "./helpers/run-cli.js";

const env = testEnv();

describe("page commands", () => {
  let spaceId: string;
  let pageId: string;

  beforeAll(async () => {
    const result = await runCli(
      ["space-create", "--name", `page-test-space-${Date.now()}`],
      env,
    );
    spaceId = parseEnvelope(result).data.id;
  });

  it("page-create creates a page", async () => {
    const result = await runCli(
      ["page-create", "--space-id", spaceId, "--title", "Test Page"],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(envelope.data).toHaveProperty("id");
    pageId = envelope.data.id;
  });

  it("page-list returns pages in space", async () => {
    const result = await runCli(
      ["page-list", "--space-id", spaceId],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(Array.isArray(envelope.data)).toBe(true);
    expect(envelope.data.length).toBeGreaterThanOrEqual(1);
  });

  it("page-info returns page details", async () => {
    const result = await runCli(
      ["page-info", "--page-id", pageId],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.id).toBe(pageId);
  });

  it("page-breadcrumbs returns path", async () => {
    const result = await runCli(
      ["page-breadcrumbs", "--page-id", pageId],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(Array.isArray(envelope.data)).toBe(true);
  });

  it("page-duplicate duplicates a page", async () => {
    const result = await runCli(
      ["page-duplicate", "--page-id", pageId],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(envelope.data).toHaveProperty("id");
    expect(envelope.data.id).not.toBe(pageId);
  });

  it("page-history returns history", async () => {
    const result = await runCli(
      ["page-history", "--page-id", pageId],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
  });

  it("page-delete deletes a page", async () => {
    const result = await runCli(
      ["page-delete", "--page-id", pageId],
      env,
    );
    expect(result.exitCode).toBe(0);
  });

  it("page-info on deleted page returns error", async () => {
    const result = await runCli(
      ["page-info", "--page-id", pageId],
      env,
    );
    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(false);
  });

  afterAll(async () => {
    if (spaceId) {
      await runCli(["space-delete", "--space-id", spaceId], env);
    }
  });
});
```

**Step 2: Run and verify**

```bash
npm run test:integration -- --reporter=verbose src/__tests__/integration/page.test.ts
```

**Step 3: Commit**

```bash
git add src/__tests__/integration/page.test.ts
git commit -m "test: add page CRUD integration tests"
```

---

### Task 8: Integration test — group commands

**Files:**
- Create: `src/__tests__/integration/group.test.ts`

**Step 1: Write the test**

```typescript
import { describe, it, expect, afterAll } from "vitest";
import { runCli, parseEnvelope, testEnv } from "./helpers/run-cli.js";

const env = testEnv();

describe("group commands", () => {
  let groupId: string;
  const groupName = `test-group-${Date.now()}`;

  it("group-create creates a group", async () => {
    const result = await runCli(
      ["group-create", "--name", groupName],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(envelope.data).toHaveProperty("id");
    groupId = envelope.data.id;
  });

  it("group-list includes created group", async () => {
    const result = await runCli(["group-list"], env);
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    const names = envelope.data.map((g: any) => g.name);
    expect(names).toContain(groupName);
  });

  it("group-info returns group details", async () => {
    const result = await runCli(
      ["group-info", "--group-id", groupId],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.id).toBe(groupId);
  });

  it("group-update changes name", async () => {
    const newName = `${groupName}-updated`;
    const result = await runCli(
      ["group-update", "--group-id", groupId, "--name", newName],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
  });

  it("group-member-list returns members", async () => {
    const result = await runCli(
      ["group-member-list", "--group-id", groupId],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
  });

  afterAll(async () => {
    if (groupId) {
      await runCli(["group-delete", "--group-id", groupId], env);
    }
  });
});
```

**Step 2: Run and verify, commit**

```bash
npm run test:integration -- --reporter=verbose src/__tests__/integration/group.test.ts
git add src/__tests__/integration/group.test.ts
git commit -m "test: add group CRUD integration tests"
```

---

### Task 9: Integration test — comment commands

**Files:**
- Create: `src/__tests__/integration/comment.test.ts`

**Step 1: Write the test**

Comments require a page, so we need setup.

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runCli, parseEnvelope, testEnv } from "./helpers/run-cli.js";

const env = testEnv();

describe("comment commands", () => {
  let spaceId: string;
  let pageId: string;
  let commentId: string;

  beforeAll(async () => {
    const spaceResult = await runCli(
      ["space-create", "--name", `comment-test-space-${Date.now()}`],
      env,
    );
    spaceId = parseEnvelope(spaceResult).data.id;

    const pageResult = await runCli(
      ["page-create", "--space-id", spaceId, "--title", "Comment Test Page"],
      env,
    );
    pageId = parseEnvelope(pageResult).data.id;
  });

  it("comment-create creates a comment", async () => {
    const result = await runCli(
      ["comment-create", "--page-id", pageId, "--content", "Test comment"],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(envelope.data).toHaveProperty("id");
    commentId = envelope.data.id;
  });

  it("comment-list returns comments for page", async () => {
    const result = await runCli(
      ["comment-list", "--page-id", pageId],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(Array.isArray(envelope.data)).toBe(true);
    expect(envelope.data.length).toBeGreaterThanOrEqual(1);
  });

  it("comment-info returns comment details", async () => {
    const result = await runCli(
      ["comment-info", "--comment-id", commentId],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.id).toBe(commentId);
  });

  it("comment-delete deletes the comment", async () => {
    const result = await runCli(
      ["comment-delete", "--comment-id", commentId],
      env,
    );
    expect(result.exitCode).toBe(0);
  });

  afterAll(async () => {
    if (spaceId) {
      await runCli(["space-delete", "--space-id", spaceId], env);
    }
  });
});
```

**Step 2: Run and verify, commit**

```bash
npm run test:integration -- --reporter=verbose src/__tests__/integration/comment.test.ts
git add src/__tests__/integration/comment.test.ts
git commit -m "test: add comment CRUD integration tests"
```

---

### Task 10: Integration test — user commands

**Files:**
- Create: `src/__tests__/integration/user.test.ts`

**Step 1: Write the test**

```typescript
import { describe, it, expect } from "vitest";
import { runCli, parseEnvelope, testEnv } from "./helpers/run-cli.js";

const env = testEnv();

describe("user commands", () => {
  it("user-me returns current user", async () => {
    const result = await runCli(["user-me"], env);
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(envelope.data).toHaveProperty("id");
    expect(envelope.data).toHaveProperty("email");
  });
});
```

**Step 2: Run and verify, commit**

```bash
npm run test:integration -- --reporter=verbose src/__tests__/integration/user.test.ts
git add src/__tests__/integration/user.test.ts
git commit -m "test: add user integration tests"
```

---

### Task 11: Integration test — invite commands

**Files:**
- Create: `src/__tests__/integration/invite.test.ts`

**Step 1: Write the test**

```typescript
import { describe, it, expect, afterAll } from "vitest";
import { runCli, parseEnvelope, testEnv } from "./helpers/run-cli.js";

const env = testEnv();

describe("invite commands", () => {
  let inviteId: string;
  const inviteEmail = `invite-${Date.now()}@example.com`;

  it("invite-create sends an invite", async () => {
    const result = await runCli(
      ["invite-create", "--emails", inviteEmail, "--role", "member"],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
  });

  it("invite-list includes the invite", async () => {
    const result = await runCli(["invite-list"], env);
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(Array.isArray(envelope.data)).toBe(true);

    const invite = envelope.data.find((i: any) => i.email === inviteEmail);
    expect(invite).toBeDefined();
    inviteId = invite.id;
  });

  it("invite-info returns invite details", async () => {
    const result = await runCli(
      ["invite-info", "--invitation-id", inviteId],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.email).toBe(inviteEmail);
  });

  it("invite-revoke revokes the invite", async () => {
    const result = await runCli(
      ["invite-revoke", "--invitation-id", inviteId],
      env,
    );
    expect(result.exitCode).toBe(0);
  });
});
```

**Step 2: Run and verify, commit**

```bash
npm run test:integration -- --reporter=verbose src/__tests__/integration/invite.test.ts
git add src/__tests__/integration/invite.test.ts
git commit -m "test: add invite integration tests"
```

---

### Task 12: Integration test — share commands

**Files:**
- Create: `src/__tests__/integration/share.test.ts`

**Step 1: Write the test**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runCli, parseEnvelope, testEnv } from "./helpers/run-cli.js";

const env = testEnv();

describe("share commands", () => {
  let spaceId: string;
  let pageId: string;
  let shareId: string;

  beforeAll(async () => {
    const spaceResult = await runCli(
      ["space-create", "--name", `share-test-space-${Date.now()}`],
      env,
    );
    spaceId = parseEnvelope(spaceResult).data.id;

    const pageResult = await runCli(
      ["page-create", "--space-id", spaceId, "--title", "Share Test Page"],
      env,
    );
    pageId = parseEnvelope(pageResult).data.id;
  });

  it("share-create enables sharing for a page", async () => {
    const result = await runCli(
      ["share-create", "--page-id", pageId],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(envelope.data).toHaveProperty("id");
    shareId = envelope.data.id;
  });

  it("share-info returns share details", async () => {
    const result = await runCli(
      ["share-info", "--share-id", shareId],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
  });

  it("share-for-page returns share by page ID", async () => {
    const result = await runCli(
      ["share-for-page", "--page-id", pageId],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
  });

  it("share-list returns shares", async () => {
    const result = await runCli(["share-list"], env);
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
  });

  it("share-delete removes sharing", async () => {
    const result = await runCli(
      ["share-delete", "--share-id", shareId],
      env,
    );
    expect(result.exitCode).toBe(0);
  });

  afterAll(async () => {
    if (spaceId) {
      await runCli(["space-delete", "--space-id", spaceId], env);
    }
  });
});
```

**Step 2: Run and verify, commit**

```bash
npm run test:integration -- --reporter=verbose src/__tests__/integration/share.test.ts
git add src/__tests__/integration/share.test.ts
git commit -m "test: add share integration tests"
```

---

### Task 13: Integration test — search commands

**Files:**
- Create: `src/__tests__/integration/search.test.ts`

**Step 1: Write the test**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runCli, parseEnvelope, testEnv } from "./helpers/run-cli.js";

const env = testEnv();

describe("search commands", () => {
  let spaceId: string;

  beforeAll(async () => {
    const result = await runCli(
      ["space-create", "--name", `search-test-space-${Date.now()}`],
      env,
    );
    spaceId = parseEnvelope(result).data.id;

    // Create a page with searchable content
    await runCli(
      ["page-create", "--space-id", spaceId, "--title", "UniqueSearchTerm42"],
      env,
    );

    // Poll until search index catches up (max 15s)
    for (let i = 0; i < 15; i++) {
      const probe = await runCli(["search", "--query", "UniqueSearchTerm42"], env);
      const probeEnv = parseEnvelope(probe);
      if (probeEnv.ok && Array.isArray(probeEnv.data) && probeEnv.data.length > 0) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
  });

  it("search returns results for known term", async () => {
    const result = await runCli(
      ["search", "--query", "UniqueSearchTerm42"],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(Array.isArray(envelope.data)).toBe(true);
    expect(envelope.data.length).toBeGreaterThan(0);
  });

  it("search-suggest returns suggestions", async () => {
    const result = await runCli(
      ["search-suggest", "--query", "Unique"],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
  });

  afterAll(async () => {
    if (spaceId) {
      await runCli(["space-delete", "--space-id", spaceId], env);
    }
  });
});
```

**Step 2: Run and verify, commit**

```bash
npm run test:integration -- --reporter=verbose src/__tests__/integration/search.test.ts
git add src/__tests__/integration/search.test.ts
git commit -m "test: add search integration tests"
```

---

### Task 14: Integration test — file commands

**Files:**
- Create: `src/__tests__/integration/file.test.ts`

**Step 1: Write the test**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFileSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { runCli, parseEnvelope, testEnv } from "./helpers/run-cli.js";

const env = testEnv();

describe("file commands", () => {
  let spaceId: string;
  let pageId: string;
  let tmpDir: string;

  beforeAll(async () => {
    const spaceResult = await runCli(
      ["space-create", "--name", `file-test-space-${Date.now()}`],
      env,
    );
    spaceId = parseEnvelope(spaceResult).data.id;

    const pageResult = await runCli(
      ["page-create", "--space-id", spaceId, "--title", "File Test Page"],
      env,
    );
    pageId = parseEnvelope(pageResult).data.id;

    // Create a temp file for upload
    tmpDir = mkdtempSync(join(tmpdir(), "docmost-test-"));
    writeFileSync(join(tmpDir, "test.txt"), "Hello from integration test");
  });

  it("file-upload uploads a file", async () => {
    const result = await runCli(
      ["file-upload", "--page-id", pageId, "--file", join(tmpDir, "test.txt")],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
  });

  afterAll(async () => {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
    if (spaceId) {
      await runCli(["space-delete", "--space-id", spaceId], env);
    }
  });
});
```

**Step 2: Run and verify, commit**

```bash
npm run test:integration -- --reporter=verbose src/__tests__/integration/file.test.ts
git add src/__tests__/integration/file.test.ts
git commit -m "test: add file upload integration tests"
```

---

### Task 15: Integration test — discovery commands (migrate)

**Files:**
- Create: `src/__tests__/integration/discovery.test.ts`

This migrates the existing discovery test to the integration suite using the programmatic runner.

**Step 1: Write the test**

```typescript
import { describe, it, expect } from "vitest";
import { runCli, parseEnvelope } from "./helpers/run-cli.js";

describe("commands discovery", () => {
  it("returns envelope with all commands", async () => {
    // Discovery doesn't need auth
    const result = await runCli(["commands"], {});
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(Array.isArray(envelope.data)).toBe(true);
    expect(envelope.data.length).toBeGreaterThan(50);
    expect(envelope.meta).toEqual({ count: envelope.data.length, hasMore: false });
  });

  it("each command has name, description, options", async () => {
    const result = await runCli(["commands"], {});
    const envelope = parseEnvelope(result);

    for (const cmd of envelope.data) {
      expect(cmd).toHaveProperty("name");
      expect(cmd).toHaveProperty("description");
      expect(cmd).toHaveProperty("options");
      expect(Array.isArray(cmd.options)).toBe(true);
    }
  });
});
```

**Step 2: Run and verify, commit**

```bash
npm run test:integration -- --reporter=verbose src/__tests__/integration/discovery.test.ts
git add src/__tests__/integration/discovery.test.ts
git commit -m "test: add discovery integration test (programmatic runner)"
```

---

### Task 16: Update CI workflow

**Files:**
- Modify: `.github/workflows/ci.yml`

**Step 1: Update ci.yml**

Add integration test job alongside existing unit test job:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: npm test

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Start Docmost services
        run: docker compose -f docker-compose.test.yml up -d

      - name: Wait for Docmost
        run: ./scripts/wait-for-docmost.sh
        env:
          DOCMOST_TEST_URL: http://localhost:4010

      - run: npm ci
      - run: npm run build

      - name: Run integration tests
        run: npm run test:integration
        env:
          DOCMOST_TEST_URL: http://localhost:4010
          DOCMOST_TEST_EMAIL: test@example.com
          DOCMOST_TEST_PASSWORD: TestPassword123!

      - name: Stop services
        if: always()
        run: docker compose -f docker-compose.test.yml down -v
```

**Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add integration test job with docker-compose"
```

---

### Task 17: Final validation — run all tests

**Step 1: Start test environment locally**

```bash
docker compose -f docker-compose.test.yml up -d
./scripts/wait-for-docmost.sh
```

**Step 2: Run full integration suite**

```bash
DOCMOST_TEST_URL=http://localhost:4010 \
DOCMOST_TEST_EMAIL=test@example.com \
DOCMOST_TEST_PASSWORD='TestPassword123!' \
npm run test:integration -- --reporter=verbose
```

Expected: All tests pass.

**Step 3: Run unit tests to verify no regressions**

```bash
npm test
```

Expected: Existing unit tests still pass.

**Step 4: Stop test environment**

```bash
docker compose -f docker-compose.test.yml down -v
```

**Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "test: fix integration test issues found during validation"
```
