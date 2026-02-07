import { chromium } from "playwright";
import type { BrowserContext, Page } from "playwright";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import type { AppConfig, TokenData } from "../types/index.js";
import { BrowserAuthError } from "../utils/errors.js";
import { log } from "../utils/logger.js";
import { PurdueSSOFlow } from "./purdue-sso.js";

export class BrowserAuth {
  private config: AppConfig;
  private ssoFlow: PurdueSSOFlow;

  constructor(config: AppConfig) {
    this.config = config;
    this.ssoFlow = new PurdueSSOFlow({
      username: config.username,
      password: config.password,
      totpSecret: config.totpSecret,
    });
  }

  /**
   * Authenticate to Purdue Brightspace using browser automation.
   * Manages browser lifecycle, invokes SSO login flow if needed, and captures Bearer token via network interception.
   *
   * @returns TokenData with captured Bearer token and expiration info
   */
  async authenticate(): Promise<TokenData> {
    let context: BrowserContext | null = null;

    try {
      log("INFO", "Starting browser authentication");

      // Ensure session directory exists
      await fs.mkdir(this.config.sessionDir, { recursive: true });

      // Launch persistent browser context for session reuse
      const browserDataDir = path.join(this.config.sessionDir, "browser-data");
      log("DEBUG", `Launching browser with persistent context at ${browserDataDir}`);

      context = await chromium.launchPersistentContext(browserDataDir, {
        headless: this.config.headless,
        viewport: { width: 1280, height: 720 },
        args: ["--disable-blink-features=AutomationControlled"],
      });

      log("INFO", "Browser context launched");

      // Get or create page
      const page = context.pages()[0] || (await context.newPage());

      // CRITICAL: Set up token interception BEFORE navigation to avoid race condition
      const tokenPromise = this.setupTokenInterception(page);

      // Check if already authenticated or need to login
      await this.navigateAndLogin(page);

      // Await token from interception
      log("INFO", "Waiting for Bearer token from network interception");
      const accessToken = await tokenPromise;
      log("INFO", "Bearer token captured successfully");

      // Construct TokenData
      const now = Date.now();
      const tokenData: TokenData = {
        accessToken,
        capturedAt: now,
        expiresAt: now + this.config.tokenTtl * 1000,
        source: "browser",
      };

      // Save browser storage state as fallback for cookie persistence
      const storageStatePath = path.join(
        this.config.sessionDir,
        "storage-state.json"
      );
      log("DEBUG", `Saving storage state to ${storageStatePath}`);
      await context.storageState({ path: storageStatePath });

      log("INFO", "Authentication complete");
      return tokenData;
    } catch (error) {
      log("ERROR", "Browser authentication failed", error);
      throw new BrowserAuthError(
        "Authentication failed",
        "authenticate",
        error as Error
      );
    } finally {
      // Always close browser context
      if (context) {
        log("DEBUG", "Closing browser context");
        await context.close();
      }
    }
  }

  /**
   * Set up passive network request listener to capture Bearer token.
   * MUST be called BEFORE page.goto() to avoid race condition.
   *
   * @param page - Playwright page instance
   * @returns Promise that resolves with Bearer token string
   */
  private setupTokenInterception(page: Page): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new BrowserAuthError(
            "Token interception timed out after 120 seconds",
            "token_interception"
          )
        );
      }, 120000);

      // Passive listener for requests (not page.route which is active interception)
      page.on("request", (request) => {
        const url = request.url();

        // Look for D2L API requests
        if (url.includes("/d2l/api/")) {
          const authHeader = request.headers()["authorization"];

          if (authHeader && authHeader.startsWith("Bearer ")) {
            const token = authHeader.substring("Bearer ".length);
            log("DEBUG", `Token captured from request to ${url}`);
            clearTimeout(timeout);
            resolve(token);
          }
        }
      });

      log("DEBUG", "Token interception listener registered");
    });
  }

  /**
   * Navigate to Brightspace home and invoke SSO login if needed.
   *
   * @param page - Playwright page instance
   */
  private async navigateAndLogin(page: Page): Promise<void> {
    try {
      log("INFO", `Navigating to ${this.config.baseUrl}/d2l/home`);
      await page.goto(`${this.config.baseUrl}/d2l/home`, {
        waitUntil: "networkidle",
        timeout: 30000,
      });

      // Check if we're on the login page or already authenticated
      const currentUrl = page.url();
      log("DEBUG", `Current URL after navigation: ${currentUrl}`);

      // If we see the email input, we need to login
      const emailInput = await page
        .locator("input[type=email]")
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (emailInput) {
        log("INFO", "Login page detected - starting SSO flow");
        const loginSuccess = await this.ssoFlow.login(page);

        if (!loginSuccess) {
          throw new BrowserAuthError(
            "SSO login flow failed",
            "sso_login"
          );
        }
      } else {
        log("INFO", "Already authenticated - skipping SSO login");
      }

      // At this point, we should be on Brightspace home
      // The page will make API requests which our token interceptor will catch
      log("DEBUG", "Waiting for page to make API requests");
      await page.waitForLoadState("networkidle", { timeout: 30000 });
    } catch (error) {
      throw new BrowserAuthError(
        "Failed to navigate and login",
        "navigate_login",
        error as Error
      );
    }
  }
}
