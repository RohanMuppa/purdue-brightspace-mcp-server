import type { Page } from "playwright";
import * as OTPAuth from "otpauth";
import { BrowserAuthError } from "../utils/errors.js";
import { log } from "../utils/logger.js";

const SELECTORS = {
  emailInput: "input[type=email]",
  passwordInput: "input[type=password]",
  submitButton: "input[type=submit]",
  nextButton: "input[type=submit]",
  otherWayLink: "a#signInAnotherWay",
  totpOption: 'div[data-value="PhoneAppOTP"]',
  totpInput: "input#idTxtBx_SAOTCC_OTC",
  totpVerifyButton: "input[type=submit]",
  staySignedInYes: "input[type=submit][value='Yes']",
  institutionButton: 'button:has-text("Purdue West Lafayette")',
} as const;

interface PurdueSSOConfig {
  username?: string;
  password?: string;
  totpSecret?: string;
}

export class PurdueSSOFlow {
  private config: PurdueSSOConfig;

  constructor(config: PurdueSSOConfig) {
    this.config = config;
  }

  /**
   * Execute the complete Microsoft Entra ID SSO login flow for Purdue.
   * Handles institution selector, email/password entry, MFA (TOTP or manual), and "stay signed in" prompt.
   *
   * @param page - Playwright page instance (already navigated to Brightspace or redirected to login)
   * @returns true on successful login (URL contains /d2l/home), false on timeout/failure
   */
  async login(page: Page): Promise<boolean> {
    try {
      log("INFO", "Starting Purdue SSO login flow");

      // Step 1: Check for institution selector (may or may not appear)
      await this.handleInstitutionSelector(page);

      // Step 2: Enter email
      await this.enterEmail(page);

      // Step 3: Enter password
      await this.enterPassword(page);

      // Step 4: Handle MFA (TOTP automated or manual approval)
      await this.handleMFA(page);

      // Step 5: Handle "Stay signed in?" prompt
      await this.handleStaySignedIn(page);

      // Step 6: Wait for successful redirect to Brightspace home
      await page.waitForURL(/\/d2l\/home/, { timeout: 120000 });
      log("INFO", "Login successful - reached Brightspace home");

      return true;
    } catch (error) {
      log("ERROR", "SSO login flow failed", error);
      return false;
    }
  }

  private async handleInstitutionSelector(page: Page): Promise<void> {
    try {
      log("DEBUG", "Checking for institution selector");
      const institutionButton = await page.waitForSelector(
        SELECTORS.institutionButton,
        { timeout: 3000 }
      );
      if (institutionButton) {
        log("INFO", "Institution selector found - clicking Purdue West Lafayette");
        await institutionButton.click();
        await page.waitForLoadState("networkidle");
      }
    } catch (error) {
      // Institution selector may not appear - this is normal
      log("DEBUG", "No institution selector found (timeout expected if already logged in)");
    }
  }

  private async enterEmail(page: Page): Promise<void> {
    try {
      log("DEBUG", "Waiting for email input");
      await page.waitForSelector(SELECTORS.emailInput, { timeout: 30000 });

      if (!this.config.username) {
        throw new BrowserAuthError(
          "Username is required for SSO login",
          "email_entry"
        );
      }

      log("INFO", "Entering email");
      await page.fill(SELECTORS.emailInput, this.config.username);
      await page.click(SELECTORS.nextButton);
      await page.waitForLoadState("networkidle");
    } catch (error) {
      throw new BrowserAuthError(
        "Failed to enter email",
        "email_entry",
        error as Error
      );
    }
  }

  private async enterPassword(page: Page): Promise<void> {
    try {
      log("DEBUG", "Waiting for password input");
      await page.waitForSelector(SELECTORS.passwordInput, { timeout: 30000 });

      if (!this.config.password) {
        throw new BrowserAuthError(
          "Password is required for SSO login",
          "password_entry"
        );
      }

      log("INFO", "Entering password");
      await page.fill(SELECTORS.passwordInput, this.config.password);
      await page.click(SELECTORS.submitButton);
      await page.waitForLoadState("networkidle");
    } catch (error) {
      throw new BrowserAuthError(
        "Failed to enter password",
        "password_entry",
        error as Error
      );
    }
  }

  private async handleMFA(page: Page): Promise<void> {
    if (this.config.totpSecret) {
      await this.handleTOTPAuth(page);
    } else {
      await this.handleManualMFAApproval(page);
    }
  }

  private async handleTOTPAuth(page: Page): Promise<void> {
    try {
      log("INFO", "TOTP secret provided - attempting automated MFA");

      // Check if we need to select "Other way to sign in"
      try {
        const otherWayLink = await page.waitForSelector(
          SELECTORS.otherWayLink,
          { timeout: 3000 }
        );
        if (otherWayLink) {
          log("DEBUG", "Clicking 'Use another way to sign in'");
          await otherWayLink.click();
          await page.waitForLoadState("networkidle");

          // Select TOTP option
          log("DEBUG", "Selecting TOTP authentication option");
          const totpOption = await page.waitForSelector(
            SELECTORS.totpOption,
            { timeout: 5000 }
          );
          await totpOption.click();
          await page.waitForLoadState("networkidle");
        }
      } catch (error) {
        // TOTP input might already be visible
        log("DEBUG", "No 'other way' link found - TOTP input may already be visible");
      }

      // Generate TOTP code
      const totp = new OTPAuth.TOTP({
        issuer: "Microsoft",
        label: this.config.username || "user",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: this.config.totpSecret!,
      });
      const code = totp.generate();
      log("INFO", "Generated TOTP code");

      // Enter TOTP code
      log("DEBUG", "Waiting for TOTP input field");
      await page.waitForSelector(SELECTORS.totpInput, { timeout: 10000 });
      await page.fill(SELECTORS.totpInput, code);
      await page.click(SELECTORS.totpVerifyButton);
      log("INFO", "Submitted TOTP code");
      await page.waitForLoadState("networkidle");
    } catch (error) {
      throw new BrowserAuthError(
        "Failed to complete TOTP authentication",
        "mfa_totp",
        error as Error
      );
    }
  }

  private async handleManualMFAApproval(page: Page): Promise<void> {
    try {
      log("WARN", "Waiting for Microsoft MFA approval on your device...");
      log("INFO", "Timeout: 120 seconds");
      log("INFO", "Browser is running in headed mode - please approve the MFA request on your phone");

      // Wait for MFA approval (page will automatically redirect after approval)
      // We don't need to click anything - just wait for the redirect
      await page.waitForLoadState("networkidle", { timeout: 120000 });
      log("INFO", "MFA approval detected");
    } catch (error) {
      throw new BrowserAuthError(
        "MFA approval timed out after 120 seconds",
        "mfa_approval",
        error as Error
      );
    }
  }

  private async handleStaySignedIn(page: Page): Promise<void> {
    try {
      log("DEBUG", "Checking for 'Stay signed in?' prompt");
      const staySignedInButton = await page.waitForSelector(
        SELECTORS.staySignedInYes,
        { timeout: 10000 }
      );
      if (staySignedInButton) {
        log("INFO", "Clicking 'Yes' on 'Stay signed in?' prompt");
        await staySignedInButton.click();
        await page.waitForLoadState("networkidle");
      }
    } catch (error) {
      // Prompt may not appear - this is normal
      log("DEBUG", "No 'Stay signed in?' prompt found (this is normal)");
    }
  }
}
