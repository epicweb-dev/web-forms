import { Honeypot } from 'remix-utils/honeypot/server'

export const honeypot = new Honeypot({
	validFromFieldName: null,
})
