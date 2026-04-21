import { test, expect } from "@playwright/test";

const TEST_USERNAME = process.env.TEST_USERNAME ?? "dnbull";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "movienight";

test.describe("authentication", () => {
  test("valid credentials redirect to home", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill(TEST_USERNAME);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");
  });

  test("wrong password shows error and stays on login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill(TEST_USERNAME);
    await page.getByLabel("Password").fill("wrongpassword");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/login");
    await expect(page.getByText("Invalid credentials, please try again")).toBeVisible();
  });

  test("unknown username shows error and stays on login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill("nobody");
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/login");
    await expect(page.getByText("Invalid credentials, please try again")).toBeVisible();
  });

  test("unauthenticated visit to protected route redirects to login", async ({ page }) => {
    await page.goto("/movies");
    await expect(page).toHaveURL("/login");
  });

  test("already logged in visiting login redirects to home", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill(TEST_USERNAME);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");

    await page.goto("/login");
    await expect(page).toHaveURL("/");
  });
});
