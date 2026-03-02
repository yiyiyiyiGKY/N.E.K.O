/**
 * Memory Browser Page E2E Tests
 *
 * Tests the memory browser page UI structure and functionality.
 * Note: These tests focus on UI elements, not API responses.
 */

import { test, expect } from "@playwright/test";

test.describe("Memory Browser Page", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the Memory Browser page
    await page.goto("/memory_browser");
  });

  test("should load the page with correct title", async ({ page }) => {
    // Check that the page title is visible
    await expect(page.locator("h2")).toContainText("记忆浏览器");
  });

  test("should display tips section", async ({ page }) => {
    // Wait for page to render
    await page.waitForSelector(".neko-content", { timeout: 5000 });

    // Check for the tips section (may contain info-box class)
    const tipsBox = page.locator(".neko-info-box").first();
    await expect(tipsBox).toBeVisible();
  });

  test("should display main layout structure", async ({ page }) => {
    // Wait for page to render
    await page.waitForSelector(".main-layout", { timeout: 5000 });

    // Check for the main layout
    await expect(page.locator(".main-layout")).toBeVisible();
  });

  test("should display left column with character list", async ({ page }) => {
    // Wait for page to render
    await page.waitForSelector(".left-column", { timeout: 5000 });

    // Check for the left column
    await expect(page.locator(".left-column")).toBeVisible();
  });

  test("should display search box", async ({ page }) => {
    // Wait for page to render
    await page.waitForSelector(".search-box", { timeout: 5000 });

    // Check for the search input
    const searchInput = page.locator(".search-box input");
    await expect(searchInput).toBeVisible();
  });

  test("should display auto review toggle section", async ({ page }) => {
    // Wait for page to render
    await page.waitForSelector(".auto-review-section", { timeout: 5000 });

    // Check for the auto review section
    await expect(page.locator(".auto-review-section")).toBeVisible();

    // Check for the toggle switch
    await expect(page.locator(".neko-switch")).toBeVisible();
  });

  test("should display right column with editor panel", async ({ page }) => {
    // Wait for page to render
    await page.waitForSelector(".right-column", { timeout: 5000 });

    // Check for the right column
    await expect(page.locator(".right-column")).toBeVisible();
  });

  test("should display close button", async ({ page }) => {
    // Check for close button
    await expect(page.locator(".neko-close-btn")).toBeVisible();
  });
});
