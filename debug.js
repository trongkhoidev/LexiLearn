import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  
  page.on('pageerror', error => errors.push(error.message));
  
  // Login as Teacher
  await page.goto('http://localhost:5173/');
  await page.fill('#login-username', 'admin');
  await page.fill('#login-password', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  
  // Test GradingHub
  await page.goto('http://localhost:5173/#/grading-hub');
  await page.waitForTimeout(2000);
  const gradingContent = await page.evaluate(() => document.getElementById('main-content')?.innerText || '');
  console.log('GradingHub:', gradingContent.includes('Grading Hub') ? '✅ Renders OK' : '❌ Missing heading');
  console.log('GradingHub errors:', errors.length ? errors.join(', ') : 'None');
  
  errors.length = 0;
  
  // Test Stats
  await page.goto('http://localhost:5173/#/stats');
  await page.waitForTimeout(2000);
  const statsContent = await page.evaluate(() => document.getElementById('main-content')?.innerText || '');
  console.log('Stats:', statsContent.includes('Learning Stats') ? '✅ Renders OK' : '⚠️ No stats heading (might not be routed)');
  console.log('Stats page text:', statsContent.substring(0, 100));
  console.log('Stats errors:', errors.length ? errors.join(', ') : 'None');
  
  errors.length = 0;
  
  // Test Classrooms (should not have stale inline onclick)
  await page.goto('http://localhost:5173/#/classes');
  await page.waitForTimeout(2000);
  const classContent = await page.evaluate(() => document.getElementById('main-content')?.innerHTML || '');
  console.log('Classrooms:', classContent.includes('Simulation') ? '❌ Still has stale simulate button' : '✅ Clean');
  console.log('Classrooms errors:', errors.length ? errors.join(', ') : 'None');
  
  errors.length = 0;
  
  // Check Sidebar: Teacher should NOT see "My Assignments" or "Personal Desk"
  const sidebarHTML = await page.evaluate(() => document.getElementById('sidebar')?.innerHTML || '');
  console.log('Sidebar (Teacher):', sidebarHTML.includes('My Assignments') ? '❌ Still shows Student items' : '✅ Role-filtered correctly');
  
  // Logout and login as Student
  await page.goto('http://localhost:5173/#/dashboard');
  await page.waitForTimeout(500);
  await page.click('#dash-logout-btn');
  await page.waitForTimeout(1000);
  await page.fill('#login-username', 'user1');
  await page.fill('#login-password', 'user123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  
  // Check Sidebar: Student SHOULD see "My Assignments"
  const sidebarStudent = await page.evaluate(() => document.getElementById('sidebar')?.innerHTML || '');
  console.log('Sidebar (Student):', sidebarStudent.includes('My Assignments') ? '✅ Shows Student items' : '❌ Missing Student items');
  console.log('Sidebar (Student):', sidebarStudent.includes('Grading Hub') ? '❌ Shows Teacher items' : '✅ Teacher items hidden');
  
  await browser.close();
  console.log('\n✅ Phase 1 verification complete');
})();
