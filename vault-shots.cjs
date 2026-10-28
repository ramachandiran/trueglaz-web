const { chromium } = require('playwright')
const OUT = '/tmp/claude-0/-home-user-trueglaz-api/8aa8754a-c7ea-58c5-b766-8af2218f53a4/scratchpad/vault'
const BASE = 'http://127.0.0.1:5173'
const EMAIL = 'buyer@trueglaz.demo'

async function session() {
  const rc = await (await fetch(`${BASE}/api/v1/auth/request-code`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact: EMAIL }),
  })).json()
  const v = await (await fetch(`${BASE}/api/v1/auth/verify`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact: EMAIL, code: rc.devCode }),
  })).json()
  return { token: v.token, expiresAt: v.expiresAt, userId: v.user.userId, displayName: v.user.displayName,
    email: v.user.email, roles: v.user.roles, sellerActivatedAt: v.user.sellerActivatedAt }
}

;(async () => {
  const s = await session()
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: 1040, height: 1320 }, deviceScaleFactor: 2 })
  await ctx.addInitScript((sess) => {
    try { localStorage.setItem('trueglaz.session', JSON.stringify(sess)) } catch (e) {}
  }, s)
  const p = await ctx.newPage()

  await p.goto(`${BASE}/vault`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(900)
  await p.screenshot({ path: `${OUT}/pin-1-standard.png`, fullPage: true })
  console.log('shot 1: standard')

  // open the "Turn on extra privacy" setup modal
  await p.getByRole('button', { name: 'Add a PIN' }).click()
  await p.waitForTimeout(400)
  await p.screenshot({ path: `${OUT}/pin-2-setup.png`, fullPage: true })
  console.log('shot 2: setup modal')

  // set a PIN -> recovery code screen
  const pins = p.locator('.vault__modal input[inputmode="numeric"]')
  await pins.nth(0).fill('4321')
  await pins.nth(1).fill('4321')
  await p.getByRole('button', { name: 'Turn on' }).click()
  await p.waitForSelector('.vault__recovery', { timeout: 8000 })
  await p.waitForTimeout(400)
  await p.screenshot({ path: `${OUT}/pin-3-recovery.png`, fullPage: true })
  console.log('shot 3: recovery code')

  await p.getByRole('button', { name: /saved it/i }).click()
  await p.waitForTimeout(700)

  // lock the vault -> locked state, fields hidden
  await p.getByRole('button', { name: 'Lock' }).click()
  await p.waitForTimeout(600)
  await p.screenshot({ path: `${OUT}/pin-4-locked.png`, fullPage: true })
  console.log('shot 4: locked')

  // unlock prompt
  await p.getByRole('button', { name: 'Unlock' }).click()
  await p.waitForTimeout(400)
  await p.screenshot({ path: `${OUT}/pin-5-unlock.png`, fullPage: true })
  console.log('shot 5: unlock modal')

  await b.close()
  console.log('done')
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
