import { Response, type DataFunctionArgs } from '@remix-run/node'
import fs from 'node:fs'
import { PassThrough } from 'node:stream'
import { db } from '~/utils/db.server.ts'
import { invariantResponse } from '~/utils/misc.ts'

export async function loader({ params }: DataFunctionArgs) {
	invariantResponse(params.imageId, 'Invalid image ID')
	const image = db.image.findFirst({
		where: { id: { equals: params.imageId } },
	})
	invariantResponse(image, 'Image not found', { status: 404 })

	const { filepath, contentType } = image
	const fileStat = await fs.promises.stat(filepath)
	const body = new PassThrough()
	const stream = fs.createReadStream(filepath)
	stream.on('open', () => stream.pipe(body))
	stream.on('error', err => body.end(err))
	stream.on('end', () => body.end())
	return new Response(body, {
		status: 200,
		headers: {
			'content-type': contentType,
			'content-length': fileStat.size.toString(),
			'content-disposition': `inline; filename="${params.imageId}"`,
			'cache-control': 'public, max-age=31536000, immutable',
		},
	})
}
