import { installGlobals } from '@remix-run/node'
installGlobals()

if (
	process.env.NODE_ENV !== 'production' ||
	process.env.PLAYWRIGHT_TEST_BASE_URL
) {
	process.env.TESTING = 'true'
}

if (process.env.NODE_ENV === 'production') {
	await import('./server-build/index.js')
} else {
	await import('./server/index.ts')
}
