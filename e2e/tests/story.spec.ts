/**
 * The whole LoyalLink story through the real UI (docs/10-TESTING.md):
 * shop owner onboards → ops approves → owner funds pool via UPI (sandbox) → launches
 * "3 visits → 20% off" → a Hindi-speaking customer joins → 3 counter scans → reward →
 * redeemed on a ₹1,200 bill → anyone verifies the public ledger.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';

async function login(page: Page, phone: string, name?: string) {
  await page.goto('/login');
  await page.locator('input[type=tel]').fill(phone);
  await page.locator('button[type=submit]').click();
  const code = (await page.locator('[role=note] b').textContent())!.trim();
  await page.locator('input[autocomplete=one-time-code]').fill(code);
  await page.locator('button[type=submit]').click();
  if (name) {
    await page.locator('input[autocomplete=given-name]').fill(name);
    await page.locator('button[type=submit]').click();
  }
}

async function newPage(browser: Browser, opts: { lang?: string; desktop?: boolean } = {}) {
  const ctx = await browser.newContext(opts.desktop ? { viewport: { width: 1280, height: 900 } } : {});
  if (opts.lang) await ctx.addInitScript((l) => localStorage.setItem('ll_lang', l), opts.lang);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { page, errors };
}

test('shop → offer → customer → counter → reward → redeem → proof', async ({ browser }) => {
  // ── 1. Shop owner onboards ──
  const { page: owner, errors: ownerErrors } = await newPage(browser, { desktop: true });
  await login(owner, '9800011111', 'Rohan');
  await owner.goto('/merchant');
  await expect(owner.getByRole('heading', { name: 'Set up your shop' })).toBeVisible();
  await owner.getByLabel('Shop name').fill('Sharma General Store');
  await owner.getByLabel('Address').fill('14 FC Road, Shivajinagar');
  await owner.getByLabel('City').fill('Pune');
  await owner.getByRole('button', { name: 'Continue' }).click();
  await owner.getByLabel('UPI ID for payouts').fill('sharma@okaxis');
  await owner.getByRole('button', { name: 'Continue' }).click();
  await owner.getByRole('button', { name: 'Submit for verification' }).click();
  await expect(owner.getByText('Verification in progress')).toBeVisible();
  const shopUrl = owner.url();

  // ── 2. Ops approves (KYC queue) ──
  const { page: admin } = await newPage(browser, { desktop: true });
  await login(admin, '9999911111', 'Priya');
  await admin.goto('/admin');
  await admin.getByRole('tab', { name: 'Shops' }).click();
  await expect(admin.getByText('Sharma General Store')).toBeVisible();
  await admin.getByRole('button', { name: 'Approve' }).click();
  await expect(admin.getByText('Nothing here')).toBeVisible();

  // ── 3. Owner funds the pool via UPI (sandbox) ──
  await owner.goto(`${shopUrl}/pool`);
  await expect(owner.getByText('Verification in progress')).toHaveCount(0);
  await owner.getByRole('button', { name: '₹1,000', exact: true }).click();
  await owner.getByRole('button', { name: /Pay ₹1,000 with UPI/ }).click();
  await expect(owner.getByText('Test mode.')).toBeVisible();
  await owner.getByRole('button', { name: 'Pay ₹1,000' }).click();
  await expect(owner).toHaveURL(/\/pool\?paid=1/);
  await expect(owner.getByText('₹1,000').first()).toBeVisible();

  // ── 4. Launch "3 visits → 20% off" (the default idea) ──
  await owner.goto(`${shopUrl}/offers/new`);
  await expect(owner.getByText('Make 3 purchases totalling ₹1,500 within 30 days')).toBeVisible();
  for (let i = 0; i < 3; i++) await owner.getByRole('button', { name: 'Continue' }).click();
  await owner.getByRole('button', { name: 'Launch offer' }).click();
  await expect(owner.getByText('Live', { exact: true })).toBeVisible();

  // ── 5. A customer joins, in Hindi ──
  const { page: cust, errors: custErrors } = await newPage(browser, { lang: 'hi' });
  await login(cust, '9800022222', 'Meena');
  await cust.goto('/explore');
  await cust.getByText('Sharma General Store').first().click();
  await expect(cust.getByText('₹300 का इनाम दुकान ने पहले से अलग रख दिया है')).toBeVisible();
  await cust.getByRole('button', { name: 'इस ऑफ़र से जुड़ें' }).click();
  await expect(cust.getByRole('heading', { name: 'आप जुड़ गए!' })).toBeVisible();

  // ── 6. Three bills at the counter ──
  await cust.goto('/qr');
  const codeText = cust.locator('[aria-live=polite]').first();
  await expect(codeText).toHaveText(/\d{3} \d{3}/);
  await owner.goto(`${shopUrl}/counter`);
  for (const bill of ['600', '450', '520']) {
    const code = (await codeText.textContent())!.replace(/\s/g, '');
    await owner.getByLabel('Customer’s 6-digit code').fill(code);
    await owner.getByRole('button', { name: 'Find customer' }).click();
    await expect(owner.getByRole('button', { name: 'Next customer' })).toBeVisible();
    await owner.getByRole('textbox', { name: 'Bill total' }).fill(bill);
    await owner.getByRole('button', { name: 'Record purchase' }).click();
    await expect(owner.getByText(/counted|reward unlocked/)).toBeVisible();
    if (bill !== '520') await owner.getByRole('button', { name: 'Next customer' }).click();
  }
  await expect(owner.getByText(/reward unlocked: 20% off your next bill \(up to ₹300\)/)).toBeVisible();
  // the customer's screen updates live
  await expect(cust.getByText('इनाम मिल गया! 🎉')).toBeVisible({ timeout: 10_000 });

  // ── 7. Redeem on the next bill of ₹1,200 → ₹240 off ──
  await owner.getByRole('button', { name: 'Next customer' }).click();
  await cust.getByRole('button', { name: 'नया कोड लें' }).click();
  await expect(codeText).toHaveText(/\d{3} \d{3}/);
  await owner.getByLabel('Customer’s 6-digit code').fill((await codeText.textContent())!.replace(/\s/g, ''));
  await owner.getByRole('button', { name: 'Find customer' }).click();
  await owner.getByRole('button', { name: 'Use', exact: true }).click();
  await owner.getByRole('textbox', { name: 'Bill total' }).fill('1200');
  await expect(owner.getByText('−₹240')).toBeVisible();
  await owner.getByRole('button', { name: 'Apply discount' }).click();
  await expect(owner.getByText('Give ₹240 off')).toBeVisible();
  await expect(owner.getByText('Collect ₹960 from the customer.')).toBeVisible();
  await expect(cust.getByText('आपने ₹240 बचाए')).toBeVisible({ timeout: 10_000 });

  // ── 8. Pool reflects reimbursement: 1000 − 300 + (240 − 4.80) + 60 = ₹995.20 ──
  await owner.goto(`${shopUrl}/pool`);
  await expect(owner.getByText('₹995.20').first()).toBeVisible();

  // ── 9. Anyone can verify the public ledger ──
  const { page: anon } = await newPage(browser);
  await anon.goto('/proof');
  await anon.getByRole('button', { name: 'Verify the whole chain in my browser' }).click();
  await expect(anon.getByText(/✓ All \d+ entries verified/)).toBeVisible();

  expect([...ownerErrors, ...custErrors]).toEqual([]);
});
