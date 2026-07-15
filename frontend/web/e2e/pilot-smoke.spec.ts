import { expect, test } from '@playwright/test'
import { createOwnerViaApi } from './helpers'

test.describe('Pilot smoke', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Вход в аккаунт' })).toBeVisible()
    await expect(page.locator('#login-email')).toBeVisible()
  })

  test('owner lands on dashboard after login (15-second test)', async ({ page }) => {
    const user = await createOwnerViaApi()

    await page.goto('/login')
    await page.locator('#login-email').fill(user.email)
    await page.locator('#login-password').fill(user.password)
    await page.getByRole('button', { name: 'Войти' }).click()

    await expect(page).toHaveURL(/\/(onboarding\/business-profile|\/?$)/, { timeout: 20_000 })

    if (page.url().includes('/onboarding/business-profile')) {
      await page.goto('/')
    }

    await expect(page.getByText('Отчётность', { exact: false }).first()).toBeVisible({ timeout: 25_000 })
    await expect(page.getByRole('navigation', { name: 'Зоны' })).toBeVisible()
  })

  test('accountant redirect to workspace queues', async ({ page, request }) => {
    const owner = await createOwnerViaApi()
    const api = process.env.PILOT_E2E_API_URL || 'http://127.0.0.1:8765'
    const accountantEmail = `pilot_acc_${Date.now()}@example.com`

    const invite = await request.post(`${api}/api/v1/team/invite`, {
      headers: { Authorization: `Bearer ${owner.accessToken}` },
      data: { email: accountantEmail, role: 'accountant' },
    })
    expect(invite.ok()).toBeTruthy()
    const inviteBody = (await invite.json()) as { invite_code: string }

    const accept = await request.post(`${api}/api/v1/team/accept-invite`, {
      data: {
        invite_code: inviteBody.invite_code,
        password: 'PilotAccPass1!',
        full_name: 'Pilot Accountant',
      },
    })
    expect(accept.ok()).toBeTruthy()

    await page.goto('/login')
    await page.locator('#login-email').fill(accountantEmail)
    await page.locator('#login-password').fill('PilotAccPass1!')
    await page.getByRole('button', { name: 'Войти' }).click()

    await expect(page).toHaveURL(/\/workspace\/queues/, { timeout: 25_000 })
    await expect(page.getByRole('link', { name: /клиентам/i })).toBeVisible()
  })
})
