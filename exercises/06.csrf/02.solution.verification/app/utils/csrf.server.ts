import { createCookie } from '@remix-run/node'
import { CSRF } from 'remix-utils'

const cookie = createCookie('csrf', {
	path: '/',
	httpOnly: true,
	secure: process.env.NODE_ENV === 'production',
	sameSite: 'lax',
	secrets: process.env.SESSION_SECRET.split(','),
})

export const csrf = new CSRF({ cookie, formDataKey: 'csrf' })
