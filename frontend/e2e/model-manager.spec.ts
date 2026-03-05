/**
 * Model Manager Page E2E Tests
 *
 * Tests the model management page functionality.
 */

import { test, expect } from "@playwright/test";

test.describe("Model Manager Page", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the Model Manager page
    await page.goto("/model_manager");
  });

  test("should load the page with correct title", async ({ page }) => {
    // Check that the page title is visible
    await expect(page.locator("h2")).toContainText("模型管理");
  });

  test("should display sidebar with controls", async ({ page }) => {
    // Wait for page to render
    await page.waitForSelector(".model-sidebar", { timeout: 5000 });

    // Check for sidebar
    await expect(page.locator(".model-sidebar")).toBeVisible();
  });

  test("should display import button", async ({ page }) => {
    // Wait for page to render
    await page.waitForSelector(".button-row", { timeout: 5000 });

    // Check for the import button
    await expect(page.locator(".button-row .neko-btn-primary")).toBeVisible();
    await expect(page.locator(".button-row .neko-btn-primary")).toContainText("导入模型");
  });

  test("should display delete all button", async ({ page }) => {
    // Wait for page to render
    await page.waitForSelector(".button-row", { timeout: 5000 });

    // Check for the delete all button
    await expect(page.locator(".button-row .neko-btn-danger")).toBeVisible();
    await expect(page.locator(".button-row .neko-btn-danger")).toContainText("全部删除");
  });

  test("should display preview area", async ({ page }) => {
    // Wait for page to render
    await page.waitForSelector(".preview-area", { timeout: 5000 });

    // Check for the preview area
    await expect(page.locator(".preview-area")).toBeVisible();
  });

  test("should display control groups", async ({ page }) => {
    // Wait for page to render
    await page.waitForSelector(".control-group", { timeout: 5000 });

    // Check for control groups
    const controlGroups = page.locator(".control-group");
    await expect(controlGroups.first()).toBeVisible();
  });

  test("should display back button", async ({ page }) => {
    // Wait for page to render
    await page.waitForSelector(".neko-btn-primary", { timeout: 5000 });

    // Check for back button
    const backButton = page.locator(".neko-btn-primary").first();
    await expect(backButton).toBeVisible();
    await expect(backButton).toContainText("返回主页");
  });
});
