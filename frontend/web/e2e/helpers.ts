const apiURL = () => process.env.PILOT_E2E_API_URL || 'http://127.0.0.1:8765'

export type PilotUser = {
  email: string
  password: string
  accessToken: string
}

export async function createOwnerViaApi(): Promise<PilotUser> {
  const suffix = Date.now()
  const email = `pilot_e2e_${suffix}@example.com`
  const password = 'PilotE2ePass1!'
  const register = await fetch(`${apiURL()}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      email,
      password,
      full_name: 'Pilot E2E Owner',
      org_name: `ИП Pilot ${suffix}`,
      org_unp: String(suffix).slice(-9).padStart(9, '0'),
      legal_form: 'ip',
      tax_regime: 'single_tax',
    }),
  })
  if (!register.ok) {
    throw new Error(`register failed: ${register.status} ${await register.text()}`)
  }
  const tokens = (await register.json()) as { access_token: string }

  const profile = await fetch(`${apiURL()}/api/v1/team/organization/business-profile`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${tokens.access_token}`,
    },
    body: JSON.stringify({
      legal_form: 'ip',
      tax_regime: 'single_tax',
      employee_count_band: 'none',
      mark_completed: true,
    }),
  })
  if (!profile.ok) {
    throw new Error(`business profile failed: ${profile.status} ${await profile.text()}`)
  }

  return { email, password, accessToken: tokens.access_token }
}
