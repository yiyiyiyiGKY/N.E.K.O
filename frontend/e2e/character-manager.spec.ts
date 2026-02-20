/**
 * Character Manager Page E2E Tests
 *
 * Tests the character management page functionality.
 */

import { test, expect } from "@playwright/test";

test.describe("Character Manager Page", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the Character Manager page
    await page.goto("/chara_manager");
  });

  test("should load the page successfully", async ({ page }) => {
    // Check that the page title is visible
    await expect(page.locator("h2")).toContainText("角色管理");

    // Check that the loading state is not visible
    await expect(page.locator(".neko-loading")).not.toBeVisible();
  });

  test("should display master profile section", async ({ page }) => {
    // Check for the master section
    await expect(page.locator(".master-section")).toBeVisible();

    // Check for the required field indicator
    await expect(page.locator(".master-section .required")).toBeVisible();
  });

  test("should display catgirl section with add button", async ({ page }) => {
    // Check for the catgirl section
    await expect(page.locator(".catgirl-section")).toBeVisible();

    // Check for the add button
    await expect(page.locator(".add-button")).toBeVisible();
    await expect(page.locator(".add-button")).toContainText("新增猫娘");
  });

  test("should open add catgirl modal when clicking add button", async ({ page }) => {
    // Click the add button
    await page.locator(".add-button").click();

    // Modal should be visible
    await expect(page.locator(".neko-modal")).toBeVisible();
    await expect(page.locator(".neko-modal-header h3")).toContainText("新增猫娘");
  });

  test("should close modal when clicking cancel", async ({ page }) => {
    // Open modal
    await page.locator(".add-button").click();
    await expect(page.locator(".neko-modal")).toBeVisible();

    // Click cancel button
    await page.locator(".neko-modal .neko-btn-secondary").click();

    // Modal should be closed
    await expect(page.locator(".neko-modal")).not.toBeVisible();
  });

  test("should navigate to API key settings when clicking the button", async ({ page }) => {
    // Click the API Key Settings button
    await page.locator(".api-key-btn").click();

    // Should navigate to API key settings
    await expect(page).toHaveURL("/api_key");
  });

  test("should close page and navigate to home", async ({ page }) => {
    // Click close button
    await page.locator(".neko-close-btn").click();

    // Should navigate to home
    await expect(page).toHaveURL("/");
  });
});
