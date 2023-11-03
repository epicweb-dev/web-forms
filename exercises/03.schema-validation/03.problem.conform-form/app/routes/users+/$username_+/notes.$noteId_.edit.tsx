import { parse } from '@conform-to/zod'
import { json, redirect, type DataFunctionArgs } from '@remix-run/node'
import { Form, useActionData, useLoaderData } from '@remix-run/react'
import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { floatingToolbarClassName } from '#app/components/floating-toolbar.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Input } from '#app/components/ui/input.tsx'
import { Label } from '#app/components/ui/label.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { Textarea } from '#app/components/ui/textarea.tsx'
import { db, updateNote } from '#app/utils/db.server.ts'
import {
	invariantResponse,
	useFocusInvalid,
	useIsSubmitting,
} from '#app/utils/misc.tsx'

export async function loader({ params }: DataFunctionArgs) {
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

const titleMaxLength = 100
const contentMaxLength = 10000

const NoteEditorSchema = z.object({
	title: z.string().max(titleMaxLength),
	content: z.string().max(contentMaxLength),
})

export async function action({ request, params }: DataFunctionArgs) {
	invariantResponse(params.noteId, 'noteId param is required')

	const formData = await request.formData()
	const submission = parse(formData, {
		schema: NoteEditorSchema,
	})

	if (!submission.value) {
		return json({ status: 'error', submission } as const, { status: 400 })
	}
	const { title, content } = submission.value

	await updateNote({ id: params.noteId, title, content })

	return redirect(`/users/${params.username}/notes/${params.noteId}`)
}

function ErrorList({
	id,
	errors,
}: {
	id?: string
	errors?: Array<string> | null
}) {
	return errors?.length ? (
		<ul id={id} className="flex flex-col gap-1">
			{errors.map((error, i) => (
				<li key={i} className="text-[10px] text-foreground-destructive">
					{error}
				</li>
			))}
		</ul>
	) : null
}

// 💣 You can delete this hook. Conform will handle this for us.
function useHydrated() {
	const [hydrated, setHydrated] = useState(false)
	useEffect(() => setHydrated(true), [])
	return hydrated
}

export default function NoteEdit() {
	const data = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()
	// 💣 we don't need the formRef anymore
	const formRef = useRef<HTMLFormElement>(null)
	// 💣 we don't need the formId anymore
	const formId = 'note-editor'
	const isSubmitting = useIsSubmitting()

	// 💣 delete everthing between here and the next 💣
	const fieldErrors =
		actionData?.status === 'error' ? actionData.submission.error : null
	const formErrors =
		actionData?.status === 'error' ? actionData.submission.error[''] : null
	const isHydrated = useHydrated()

	const formHasErrors = Boolean(formErrors?.length)
	const formErrorId = formHasErrors ? 'form-error' : undefined
	const titleHasErrors = Boolean(fieldErrors?.title?.length)
	const titleErrorId = titleHasErrors ? 'title-error' : undefined
	const contentHasErrors = Boolean(fieldErrors?.content?.length)
	const contentErrorId = contentHasErrors ? 'content-error' : undefined

	useFocusInvalid(formRef.current, actionData?.status === 'error')
	// 💣 delete everthing between here and the previous 💣
	// Conform does a lot for us huh!? 🤯

	// 🐨 add your useForm config here
	// 💰 reference the instructions for what it should look like
	// 💰 make sure to check on the defaultValue in the instructions as well

	return (
		<div className="absolute inset-0">
			<Form
				// 💣 delete the id and noValidate props
				id={formId}
				noValidate={isHydrated}
				method="post"
				className="flex h-full flex-col gap-y-4 overflow-y-auto overflow-x-hidden px-10 pb-28 pt-12"
				// 💣 delete the rest of these props
				aria-invalid={formHasErrors || undefined}
				aria-describedby={formErrorId}
				ref={formRef}
				tabIndex={-1}
				// 🐨 add {...form.props} here
			>
				<div className="flex flex-col gap-1">
					<div>
						{/* 🐨 replace the hard-coded "note-title" for fields.title.id */}
						<Label htmlFor="note-title">Title</Label>
						<Input
							// 💣 everything between here and the next 💣 can be deleted
							id="note-title"
							name="title"
							defaultValue={data.note.title}
							required
							maxLength={titleMaxLength}
							aria-invalid={titleHasErrors || undefined}
							aria-describedby={titleErrorId}
							// 💣 everything between here and the previous 💣 can be deleted
							autoFocus
							// 🐨 add {...conform.input(fields.title)} here
						/>
						<div className="min-h-[32px] px-4 pb-3 pt-1">
							{/* 🐨 get the id from fields.title.errorId */}
							{/* 🐨 get the errors from fields.title.errors */}
							<ErrorList id={titleErrorId} errors={fieldErrors?.title} />
						</div>
					</div>
					<div>
						{/* 🐨 replace the hard-coded "note-content" for fields.content.id */}
						<Label htmlFor="note-content">Content</Label>
						<Textarea
							// 💣 everything between here and the next 💣 can be deleted
							id="note-content"
							name="content"
							defaultValue={data.note.content}
							required
							maxLength={contentMaxLength}
							aria-invalid={contentHasErrors || undefined}
							aria-describedby={contentErrorId}
							// 💣 everything between here and the previous 💣 can be deleted
							// 🐨 add {...conform.textarea(fields.content)} here
						/>
						<div className="min-h-[32px] px-4 pb-3 pt-1">
							{/* 🐨 get the id from fields.content.errorId */}
							{/* 🐨 get the errors from fields.content.errors */}
							<ErrorList id={contentErrorId} errors={fieldErrors?.content} />
						</div>
					</div>
				</div>
				{/* 🐨 get the id from form.errorId */}
				{/* 🐨 get the errors from form.errors */}
				<ErrorList id={formErrorId} errors={formErrors} />
			</Form>
			<div className={floatingToolbarClassName}>
				{/* 🐨 replace formId with form.id */}
				<Button form={formId} variant="destructive" type="reset">
					Reset
				</Button>
				<StatusButton
					// 🐨 replace formId with form.id
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
