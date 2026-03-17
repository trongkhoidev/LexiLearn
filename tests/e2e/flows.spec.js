import { test, expect } from '@playwright/test';

test.describe('LexiLearn E2E Roles Test', () => {

  test('Teacher flow', async ({ page }) => {
    await page.goto('/');

    // Login as Teacher
    await expect(page.locator('#login-username')).toBeVisible();
    await page.fill('#login-username', 'admin');
    await page.fill('#login-password', 'admin123');
    await page.click('button[type="submit"]');

    // Wait for dashboard to load
    await expect(page.locator('h1.hero-title')).toContainText('Dr. Admin', { timeout: 10000 });
    
    // Check Classrooms
    await page.click('#dash-view-classes-btn');
    // Classrooms page has "Create Classroom" button
    await expect(page.locator('button:has-text("Create Classroom")').first()).toBeVisible();

    // Go back to Dashboard
    await page.goto('#/dashboard');

    // Check Materials Manager
    await page.click('#dash-materials-manager-btn');
    await expect(page.locator('h1').filter({ hasText: /Material Manager/i })).toBeVisible();

    // Check Decks
    await page.goto('#/dashboard');
    await page.click('#dash-vocab-decks-btn');
    await expect(page.locator('h1').filter({ hasText: /My Decks/i })).toBeVisible();

    // Check Logout
    await page.goto('#/dashboard');
    await page.click('#dash-logout-btn');
    await expect(page.locator('#login-username')).toBeVisible();
  });

  test('Student flow', async ({ page }) => {
    await page.goto('/');

    // Login as Student
    await expect(page.locator('#login-username')).toBeVisible();
    await page.fill('#login-username', 'user1');
    await page.fill('#login-password', 'user123');
    await page.click('button[type="submit"]');

    // Wait for dashboard to load
    await expect(page.locator('h1.hero-title')).toContainText('Student One', { timeout: 10000 });

    // Verify estimated band and stats
    await expect(page.locator('text=Estimated Band')).toBeVisible();
    
    // Check Personal Desk
    await page.goto('#/personal-desk');
    await expect(page.getByRole('heading', { name: /My Personal Desk/i })).toBeVisible();

    // Check Assignments
    await page.goto('#/dashboard');
    await page.click('#dash-view-assignments-btn');
    await expect(page.getByRole('heading', { name: /My Assignments/i })).toBeVisible();

    // Logout
    await page.goto('#/dashboard');
    await page.click('#dash-logout-btn');
    await expect(page.locator('#login-username')).toBeVisible();
  });

});
