import {
	json,
	redirect,
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
} from '@remix-run/node'
import { Form, useLoaderData } from '@remix-run/react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { floatingToolbarClassName } from '#app/components/floating-toolbar.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Input } from '#app/components/ui/input.tsx'
import { Label } from '#app/components/ui/label.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { Textarea } from '#app/components/ui/textarea.tsx'
import { db, updateNote } from '#app/utils/db.server.ts'
import { invariantResponse, useIsSubmitting } from '#app/utils/misc.tsx'

export async function loader({ params }: LoaderFunctionArgs) {
	const note = db.note.findFirst({
		where: {
			id: {
				equals: params.noteId,
			},
		},
	})
	if (!note) {
		throw new Response('Note not found', { status: 404 })
	}
	return json({
		note: { title: note.title, content: note.content },
	})
}

export async function action({ request, params }: ActionFunctionArgs) {
	invariantResponse(params.noteId, 'noteId param is required')

	const formData = await request.formData()
	const title = formData.get('title')
	const content = formData.get('content')
	invariantResponse(typeof title === 'string', 'title must be a string')
	invariantResponse(typeof content === 'string', 'content must be a string')

	await updateNote({ id: params.noteId, title, content })

	return redirect(`/users/${params.username}/notes/${params.noteId}`)
}

export default function NoteEdit() {
	const data = useLoaderData<typeof loader>()
	const isSubmitting = useIsSubmitting()
	const formId = 'note-editor'

	return (
		<div className="absolute inset-0">
			<Form
				id={formId}
				method="post"
				className="flex h-full flex-col gap-y-4 overflow-y-auto overflow-x-hidden px-10 pb-28 pt-12"
			>
				<div className="flex flex-col gap-1">
					<div>
						{/* 🦉 NOTE: this is not an accessible label, we'll get to that in the accessibility exercises */}
						<Label>Title</Label>
						{/* 🐨 add the appropriate HTML validation attributes here */}
						<Input name="title" defaultValue={data.note.title} />
					</div>
					<div>
						{/* 🦉 NOTE: this is not an accessible label, we'll get to that in the accessibility exercises */}
						<Label>Content</Label>
						{/* 🐨 add the appropriate HTML validation attributes here */}
						<Textarea name="content" defaultValue={data.note.content} />
					</div>
				</div>
			</Form>
			<div className={floatingToolbarClassName}>
				<Button variant="destructive" type="reset">
					{/* 🦉 NOTE: this button doesn't work right now, we'll get to that in the accessibility exercise */}
					Reset
				</Button>
				<StatusButton
					form={formId}
					type="submit"
					disabled={isSubmitting}
					status={isSubmitting ? 'pending' : 'idle'}
				>
					Submit
				</StatusButton>
			</div>
		</div>
	)
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				404: ({ params }) => (
					<p>No note with the id "{params.noteId}" exists</p>
				),
			}}
		/>
	)
}
