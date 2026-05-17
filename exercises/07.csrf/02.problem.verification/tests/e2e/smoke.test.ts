import { test, expect } from '@playwright/test'

test('can visit the home page', async ({ page }) => {
	await page.goto('/')
	await expect(page.getByRole('heading', { name: 'Epic Notes' })).toBeVisible()

	// TODO: figure out how to assert the favicon was loaded
})

test('returns 404 for POST requests to unmatched routes', async ({ request }) => {
	const response = await request.post('/connectors/resource/index.php')
	expect(response.status()).toBe(404)
})
