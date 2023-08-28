import { Honeypot } from 'remix-utils/honeypot/server'

export const honeypot = new Honeypot({
	// 🐨 set this to process.env.TESTING ? null : undefined so it's disabled during tests
	validFromFieldName: null,
})
