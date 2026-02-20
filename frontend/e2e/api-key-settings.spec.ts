/**
 * API Key Settings Page E2E Tests
 *
 * Tests the API configuration page functionality.
 */

import { test, expect } from "@playwright/test";

test.describe("API Key Settings Page", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the API Key Settings page
    await page.goto("/api_key");
  });

  test("should load the page successfully", async ({ page }) => {
    // Check that the page title is visible
    await expect(page.locator("h2")).toContainText("API Key 设置");

    // Check that the loading state is not visible
    await expect(page.locator(".neko-loading")).not.toBeVisible();
  });

  test("should display quick start guide", async ({ page }) => {
    // Check for the quick start section
    await expect(page.locator(".api-guide-box")).toBeVisible();
    await expect(page.locator(".api-guide-box h3")).toContainText("快速开始");
  });

  test("should have core API configuration form", async ({ page }) => {
    // Check for the core API configuration section
    await expect(page.locator(".config-section")).toBeVisible();

    // Check for the provider dropdown
    const providerSelect = page.locator("select").first();
    await expect(providerSelect).toBeVisible();

    // Check for the API key input
    const apiKeyInput = page.locator('input[type="text"]').first();
    await expect(apiKeyInput).toBeVisible();
  });

  test("should toggle advanced options", async ({ page }) => {
    // Advanced section should be collapsed by default
    const advancedSection = page.locator(".neko-fold");
    await expect(advancedSection).not.toHaveClass(/open/);

    // Click to expand
    await page.locator(".neko-fold-toggle").click();
    await expect(advancedSection).toHaveClass(/open/);

    // Click to collapse
    await page.locator(".neko-fold-toggle").click();
    await expect(advancedSection).not.toHaveClass(/open/);
  });

  test("should disable API key input when free tier is selected", async ({ page }) => {
    // Select free tier
    const providerSelect = page.locator("select").first();
    await providerSelect.selectOption("free");

    // API key input should be disabled
    const apiKeyInput = page.locator('input[type="text"]').first();
    await expect(apiKeyInput).toBeDisabled();
  });

  test("should enable API key input when paid provider is selected", async ({ page }) => {
    // Select a paid provider
    const providerSelect = page.locator("select").first();
    await providerSelect.selectOption("ali");

    // API key input should be enabled
    const apiKeyInput = page.locator('input[type="text"]').first();
    await expect(apiKeyInput).toBeEnabled();
  });

  test("should close page and navigate to home", async ({ page }) => {
    // Click close button
    await page.locator(".neko-close-btn").click();

    // Should navigate to home
    await expect(page).toHaveURL("/");
  });
});
