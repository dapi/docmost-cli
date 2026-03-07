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
