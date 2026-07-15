/**
 * Purge user data from browser localStorage via Playwright.
 * Usage: node scripts/purge-user-browser.mjs <username> [baseUrl]
 */
import { chromium } from 'playwright';

const username = (process.argv[2] || '').trim().toLowerCase();
const baseUrl = process.argv[3] || 'http://localhost:3000';

if (!username) {
  console.error('Usage: node scripts/purge-user-browser.mjs <username> [baseUrl]');
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

try {
  await page.goto(`${baseUrl}/purge-user.html`, { waitUntil: 'domcontentloaded', timeout: 15000 });

  const result = await page.evaluate((USER) => {
    const match = u => (u.username || '').toLowerCase() === USER
      || (u.email || '').toLowerCase().includes(USER);

    let users = JSON.parse(localStorage.getItem('hrbp_mock_users') || '[]');
    const removed = users.filter(match);
    users = users.filter(u => !match(u));
    localStorage.setItem('hrbp_mock_users', JSON.stringify(users));

    const emails = removed.map(u => u.email).filter(Boolean);
    const empIds = removed.map(u => u.emp_id).filter(Boolean);

    let reqs = JSON.parse(localStorage.getItem('hrbp_employee_requests') || '[]');
    const reqsRemoved = reqs.length;
    reqs = reqs.filter(r => !emails.includes(r.user_email) && !empIds.some(id => (r.emp_id || '') === id));
    localStorage.setItem('hrbp_employee_requests', JSON.stringify(reqs));

    let pend = JSON.parse(localStorage.getItem('hrbp_pending_requests') || '[]');
    const pendRemoved = pend.length;
    pend = pend.filter(r => !emails.includes(r.user_email));
    localStorage.setItem('hrbp_pending_requests', JSON.stringify(pend));

    const cur = JSON.parse(localStorage.getItem('hrbp_user') || 'null');
    let sessionCleared = false;
    if (cur && match(cur)) {
      localStorage.removeItem('hrbp_user');
      sessionCleared = true;
    }

    return {
      removedUsers: removed,
      requestsDeleted: reqsRemoved - reqs.length,
      pendingDeleted: pendRemoved - pend.length,
      sessionCleared,
    };
  }, username);

  console.log(`\n✅ Browser localStorage purge for "${username}":`);
  console.log(JSON.stringify(result, null, 2));

  if (result.removedUsers.length === 0) {
    console.log(`\n⚠️  ไม่พบ "${username}" ใน localStorage ของ ${baseUrl}`);
    console.log('   (อาจลบไปแล้ว หรือข้อมูลอยู่ใน D1 remote / browser อื่น)');
  } else {
    console.log(`\nพร้อมให้ ${username} ล็อกอินใหม่แล้ว`);
  }
} catch (err) {
  console.error('Failed:', err.message);
  console.error('ตรวจสอบว่า dev server รันอยู่ที่', baseUrl);
  process.exit(1);
} finally {
  await browser.close();
}