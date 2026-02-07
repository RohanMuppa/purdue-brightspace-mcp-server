import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SessionStore } from "../../src/auth/session-store.js";
import type { TokenData } from "../../src/types/index.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

describe("SessionStore", () => {
  let testDir: string;
  let sessionStore: SessionStore;

  beforeEach(async () => {
    // Create isolated temp directory for each test
    testDir = path.join(
      os.tmpdir(),
      `session-store-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    sessionStore = new SessionStore(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("encrypt/decrypt", () => {
    it("encrypt then decrypt returns original plaintext", () => {
      const plaintext = JSON.stringify({
        accessToken: "test-token-12345",
        capturedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        source: "browser",
      });

      // Access private methods via any cast for testing
      const store = sessionStore as any;
      const encrypted = store.encrypt(plaintext);
      const decrypted = store.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(encrypted.iv).toBeTruthy();
      expect(encrypted.authTag).toBeTruthy();
      expect(encrypted.data).toBeTruthy();
    });
  });

  describe("save and load", () => {
    it("save then load returns same TokenData", async () => {
      const token: TokenData = {
        accessToken: "test-token-abc123",
        capturedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        source: "browser",
      };

      await sessionStore.save(token);
      const loaded = await sessionStore.load();

      expect(loaded).toEqual(token);
    });

    it("load returns null when no session file exists", async () => {
      const loaded = await sessionStore.load();
      expect(loaded).toBeNull();
    });

    it("load returns null when session file is corrupted", async () => {
      // Create the session directory
      await fs.mkdir(testDir, { recursive: true });

      // Write garbage data to session file
      const sessionFile = path.join(testDir, "session.json");
      await fs.writeFile(sessionFile, "this is not valid JSON!");

      const loaded = await sessionStore.load();
      expect(loaded).toBeNull();
    });

    it("load returns null when session file has tampered ciphertext", async () => {
      // First save a valid token
      const token: TokenData = {
        accessToken: "test-token-tamper",
        capturedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        source: "browser",
      };
      await sessionStore.save(token);

      // Tamper with the encrypted data
      const sessionFile = path.join(testDir, "session.json");
      const fileContent = await fs.readFile(sessionFile, "utf-8");
      const sessionData = JSON.parse(fileContent);

      // Modify the ciphertext - flip some bits
      const tamperedData = sessionData.encrypted.data
        .split("")
        .map((c: string, i: number) => (i % 2 === 0 ? (c === "a" ? "b" : "a") : c))
        .join("");
      sessionData.encrypted.data = tamperedData;

      await fs.writeFile(sessionFile, JSON.stringify(sessionData));

      // Load should return null due to auth tag verification failure
      const loaded = await sessionStore.load();
      expect(loaded).toBeNull();
    });

    it("creates session directory if it does not exist", async () => {
      const token: TokenData = {
        accessToken: "test-token-mkdir",
        capturedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        source: "browser",
      };

      // testDir does not exist yet
      await sessionStore.save(token);

      // Verify directory was created
      const stats = await fs.stat(testDir);
      expect(stats.isDirectory()).toBe(true);

      // Verify file exists
      const sessionFile = path.join(testDir, "session.json");
      const fileStats = await fs.stat(sessionFile);
      expect(fileStats.isFile()).toBe(true);
    });
  });

  describe("clear", () => {
    it("clear removes session file", async () => {
      const token: TokenData = {
        accessToken: "test-token-clear",
        capturedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        source: "browser",
      };

      await sessionStore.save(token);

      // Verify file exists
      const sessionFile = path.join(testDir, "session.json");
      let stats = await fs.stat(sessionFile);
      expect(stats.isFile()).toBe(true);

      // Clear session
      await sessionStore.clear();

      // Load should return null
      const loaded = await sessionStore.load();
      expect(loaded).toBeNull();

      // File should not exist
      try {
        await fs.stat(sessionFile);
        expect.fail("Session file should not exist after clear");
      } catch (error: any) {
        expect(error.code).toBe("ENOENT");
      }
    });
  });
});
