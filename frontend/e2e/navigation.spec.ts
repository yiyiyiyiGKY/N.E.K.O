/**
 * Navigation and Routing E2E Tests
 *
 * Tests the main navigation and routing functionality.
 */

import { test, expect } from "@playwright/test";

test.describe("Navigation and Routing", () => {
  test("should load the main page", async ({ page }) => {
    await page.goto("/");

    // Main page should load - check for some key element
    await expect(page).toHaveTitle(/N.E.K.O/i);
  });

  test("should navigate to API Key Settings", async ({ page }) => {
    await page.goto("/");
    await page.goto("/api_key");

    await expect(page.locator("h2")).toContainText("API Key 设置");
  });

  test("should navigate to Character Manager", async ({ page }) => {
    await page.goto("/");
    await page.goto("/chara_manager");

    await expect(page.locator("h2")).toContainText("角色管理");
  });

  test("should navigate to Memory Browser", async ({ page }) => {
    await page.goto("/");
    await page.goto("/memory_browser");

    await expect(page.locator("h2")).toContainText("记忆浏览器");
  });

  test("should navigate to Model Manager", async ({ page }) => {
    await page.goto("/");
    await page.goto("/model_manager");

    await expect(page.locator("h2")).toContainText("模型管理");
  });

  test("should navigate to Voice Clone", async ({ page }) => {
    await page.goto("/");
    await page.goto("/voice_clone");

    await expect(page.locator("h2")).toContainText("语音克隆");
  });

  test("should navigate to Live2D Emotion Manager", async ({ page }) => {
    await page.goto("/");
    await page.goto("/live2d_emotion_manager");

    await expect(page.locator("h2")).toContainText("Live2D 情感映射管理器");
  });

  test("should navigate to VRM Emotion Manager", async ({ page }) => {
    await page.goto("/");
    await page.goto("/vrm_emotion_manager");

    await expect(page.locator("h2")).toContainText("VRM 情感映射管理器");
  });
});

test.describe("Theme and Styling", () => {
  test("should apply neko theme styles", async ({ page }) => {
    await page.goto("/api_key");

    // Check that neko container is styled
    const container = page.locator(".neko-container");
    await expect(container).toBeVisible();

    // Check that theme CSS variables are applied
    const bodyStyles = await page.evaluate(() => {
      return window.getComputedStyle(document.body);
    });

    // Body should have some background color applied
    expect(bodyStyles.backgroundColor).toBeTruthy();
  });

  test("should render buttons with neko styles", async ({ page }) => {
    await page.goto("/api_key");

    // Check primary button
    const primaryBtn = page.locator(".neko-btn-primary").first();
    await expect(primaryBtn).toBeVisible();

    // Check that button has some styling
    const btnStyles = await primaryBtn.evaluate((el) => {
      return window.getComputedStyle(el);
    });
    expect(btnStyles.backgroundColor).toBeTruthy();
  });

  test("should render inputs with neko styles", async ({ page }) => {
    await page.goto("/api_key");

    // Check input
    const input = page.locator(".neko-input").first();
    await expect(input).toBeVisible();

    // Check that input has some styling
    const inputStyles = await input.evaluate((el) => {
      return window.getComputedStyle(el);
    });
    expect(inputStyles.border).toBeTruthy();
  });
});

test.describe("Responsive Design", () => {
  test("should display correctly on mobile viewport", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/api_key");

    // Page should still load and display
    await expect(page.locator("h2")).toContainText("API Key 设置");
  });

  test("should display correctly on tablet viewport", async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/api_key");

    // Page should still load and display
    await expect(page.locator("h2")).toContainText("API Key 设置");
  });

  test("should display correctly on desktop viewport", async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/api_key");

    // Page should still load and display
    await expect(page.locator("h2")).toContainText("API Key 设置");
  });
});
