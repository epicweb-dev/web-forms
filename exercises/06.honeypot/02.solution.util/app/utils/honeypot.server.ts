import { Honeypot } from 'remix-utils'

export const honeypot = new Honeypot({
	validFromFieldName: process.env.TESTING ? undefined : null,
})
