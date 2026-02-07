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

  async authenticate(): Promise<TokenData> {
    let context: BrowserContext | null = null;

    try {
      log("INFO", "Starting browser authentication");

      await fs.mkdir(this.config.sessionDir, { recursive: true });

      const browserDataDir = path.join(this.config.sessionDir, "browser-data");
      context = await chromium.launchPersistentContext(browserDataDir, {
        headless: this.config.headless,
        viewport: { width: 1280, height: 720 },
        args: ["--disable-blink-features=AutomationControlled"],
      });

      log("INFO", "Browser context launched");

      const page = context.pages()[0] || (await context.newPage());

      // CRITICAL: Set up token interception BEFORE navigation
      const tokenPromise = this.setupTokenInterception(page);

      // Navigate and login if needed
      const alreadyAuthenticated = await this.navigateAndLogin(page);

      // If already authenticated via cookies, Bearer tokens won't appear in
      // normal page requests. Try strategies to extract a usable token.
      if (alreadyAuthenticated) {
        log("INFO", "Session cookies active — trying to extract API token");

        // Strategy 1: Navigate to API endpoint to trigger Bearer-bearing requests
        try {
          log("DEBUG", "Navigating to API endpoint to trigger token capture");
          await page.goto(
            `${this.config.baseUrl}/d2l/api/lp/1.57/users/whoami`,
            { waitUntil: "load", timeout: 15000 }
          );
        } catch {
          log("DEBUG", "Direct API navigation did not produce Bearer token");
        }

        // Strategy 2: Try extracting XSRF token from D2L's JavaScript context
        const xsrfToken = await this.extractXsrfToken(page);
        if (xsrfToken) {
          log("INFO", "Extracted XSRF token from page context");
          const now = Date.now();
          const tokenData: TokenData = {
            accessToken: xsrfToken,
            capturedAt: now,
            expiresAt: now + this.config.tokenTtl * 1000,
            source: "browser",
          };
          await this.saveStorageState(context);
          return tokenData;
        }

        // Strategy 3: Extract session cookies for cookie-based API auth
        const cookieToken = await this.extractCookieToken(context);
        if (cookieToken) {
          log("INFO", "Extracted session cookie for API auth");
          const now = Date.now();
          const tokenData: TokenData = {
            accessToken: cookieToken,
            capturedAt: now,
            expiresAt: now + this.config.tokenTtl * 1000,
            source: "browser",
          };
          await this.saveStorageState(context);
          return tokenData;
        }

        // Strategy 4: Clear cookies and force full re-login through SSO
        log("WARN", "Could not extract token from existing session, forcing re-login");
        await context.clearCookies();
        const freshTokenPromise = this.setupTokenInterception(page);
        await this.navigateAndLogin(page);
        const accessToken = await freshTokenPromise;
        log("INFO", "Bearer token captured after forced re-login");
        const now = Date.now();
        const tokenData: TokenData = {
          accessToken,
          capturedAt: now,
          expiresAt: now + this.config.tokenTtl * 1000,
          source: "browser",
        };
        await this.saveStorageState(context);
        return tokenData;
      }

      // Normal flow: token captured during SSO redirect
      log("INFO", "Waiting for Bearer token from network interception");
      const accessToken = await tokenPromise;
      log("INFO", "Bearer token captured successfully");

      const now = Date.now();
      const tokenData: TokenData = {
        accessToken,
        capturedAt: now,
        expiresAt: now + this.config.tokenTtl * 1000,
        source: "browser",
      };

      await this.saveStorageState(context);
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
      if (context) {
        log("DEBUG", "Closing browser context");
        await context.close();
      }
    }
  }

  /**
   * Set up passive network request listener to capture Bearer token.
   * MUST be called BEFORE page.goto() to avoid race condition.
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

      page.on("request", (request) => {
        const url = request.url();

        // Look for any request with a Bearer token
        if (url.includes("/d2l/")) {
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
   * Navigate to Brightspace and login if needed.
   * Returns true if already authenticated (cookies valid), false if SSO login was performed.
   */
  private async navigateAndLogin(page: Page): Promise<boolean> {
    try {
      log("INFO", `Navigating to ${this.config.baseUrl}/d2l/home`);
      await page.goto(`${this.config.baseUrl}/d2l/home`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

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
          throw new BrowserAuthError("SSO login flow failed", "sso_login");
        }

        await page.waitForLoadState("networkidle", { timeout: 30000 });
        return false;
      }

      log("INFO", "Already authenticated - skipping SSO login");
      await page.waitForLoadState("networkidle", { timeout: 30000 });
      return true;
    } catch (error) {
      if (error instanceof BrowserAuthError) throw error;
      throw new BrowserAuthError(
        "Failed to navigate and login",
        "navigate_login",
        error as Error
      );
    }
  }

  /**
   * Try to extract XSRF/API token from D2L's JavaScript context.
   * Brightspace stores auth tokens in the page's JS globals.
   */
  private async extractXsrfToken(page: Page): Promise<string | null> {
    try {
      // Navigate back to homepage where D2L JS context is available
      const currentUrl = page.url();
      if (!currentUrl.includes("/d2l/home")) {
        await page.goto(`${this.config.baseUrl}/d2l/home`, {
          waitUntil: "networkidle",
          timeout: 15000,
        });
      }

      const token = await page.evaluate(() => {
        // D2L stores XSRF token in various places
        // Try common D2L token locations
        const d2l = (window as unknown as Record<string, unknown>).D2L as
          | Record<string, unknown>
          | undefined;

        if (d2l) {
          // Try D2L.LP.Web.Authentication.Xsrf.GetXsrfToken()
          try {
            const lp = d2l.LP as Record<string, unknown> | undefined;
            const web = lp?.Web as Record<string, unknown> | undefined;
            const auth = web?.Authentication as
              | Record<string, unknown>
              | undefined;
            const xsrf = auth?.Xsrf as Record<string, unknown> | undefined;
            const getToken = xsrf?.GetXsrfToken as (() => string) | undefined;
            if (getToken) return getToken();
          } catch {
            // Not available
          }
        }

        // Try extracting from meta tags or script data
        const metaToken = document.querySelector(
          'meta[name="d2l-xsrf-token"]'
        );
        if (metaToken) return metaToken.getAttribute("content");

        // Try extracting from local storage
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes("token") || key.includes("Token"))) {
            const val = localStorage.getItem(key);
            if (val && val.length > 20) return val;
          }
        }

        return null;
      });

      if (token) {
        log("DEBUG", "Found token via page JavaScript context");
        return token;
      }

      return null;
    } catch (error) {
      log("DEBUG", "XSRF token extraction failed", error);
      return null;
    }
  }

  /**
   * Extract D2L session cookies that can be used for cookie-based API auth.
   * Constructs a cookie header string from d2lSessionVal and d2lSecureSessionVal.
   */
  private async extractCookieToken(
    context: BrowserContext
  ): Promise<string | null> {
    try {
      const cookies = await context.cookies(this.config.baseUrl);
      const relevantCookies = cookies.filter(
        (c) =>
          c.name === "d2lSessionVal" ||
          c.name === "d2lSecureSessionVal" ||
          c.name.startsWith("d2l")
      );

      if (relevantCookies.length === 0) {
        log("DEBUG", "No D2L session cookies found");
        return null;
      }

      // Build a cookie string for API requests
      const cookieStr = relevantCookies
        .map((c) => `${c.name}=${c.value}`)
        .join("; ");

      log(
        "DEBUG",
        `Found ${relevantCookies.length} D2L cookies: ${relevantCookies.map((c) => c.name).join(", ")}`
      );
      return `cookie:${cookieStr}`;
    } catch (error) {
      log("DEBUG", "Cookie extraction failed", error);
      return null;
    }
  }

  private async saveStorageState(context: BrowserContext): Promise<void> {
    try {
      const storageStatePath = path.join(
        this.config.sessionDir,
        "storage-state.json"
      );
      await context.storageState({ path: storageStatePath });
      log("DEBUG", `Storage state saved to ${storageStatePath}`);
    } catch (error) {
      log("WARN", "Failed to save storage state", error);
    }
  }
}
