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
		throw new Response('Note note found', { status: 404 })
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

	// 🐨 swap this for parse from conform, passing the formData as the first argument
	// 🐨 For the options, provide NoteEditorSchema as the "schema" and let's
	// enable the multiple errors option with "acceptMultipleErrors: () => true"
	// 🦉 it's common convention to call the variable assigned to the parse call "submission"
	const result = NoteEditorSchema.safeParse({
		title: formData.get('title'),
		content: formData.get('content'),
	})

	// instead of result.success, we can use submission.value. If there's no submission.value,
	// then there will be errors.
	// 🐨 replace "!result.success" with "!submission.value"
	if (!result.success) {
		// instead of sending back "errors," we want to send back the entire "submission"
		// 🐨 replace "errors: result.error.flatten()" with "submission"
		return json({ status: 'error', errors: result.error.flatten() } as const, {
			status: 400,
		})
	}
	// if there were no errors, we can get the (typesafe!! 🦺) values from submission.value
	// 🐨 replace "result.data" with "submission.value"
	const { title, content } = result.data

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

function useHydrated() {
	const [hydrated, setHydrated] = useState(false)
	useEffect(() => setHydrated(true), [])
	return hydrated
}

export default function NoteEdit() {
	const data = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()
	const formRef = useRef<HTMLFormElement>(null)
	const formId = 'note-editor'
	const isSubmitting = useIsSubmitting()

	// 🐨 instead of actionData.errors.fieldErrors, we'll use actionData.submission.error
	const fieldErrors =
		actionData?.status === 'error' ? actionData.errors.fieldErrors : null
	// 🐨 instead of actionData.errors.formErrors, we'll use actionData.submission.error['']
	// (Yeah, it's weird and will change... https://github.com/edmundhung/conform/issues/211)
	const formErrors =
		actionData?.status === 'error' ? actionData.errors.formErrors : null
	const isHydrated = useHydrated()

	const formHasErrors = Boolean(formErrors?.length)
	const formErrorId = formHasErrors ? 'form-error' : undefined
	const titleHasErrors = Boolean(fieldErrors?.title?.length)
	const titleErrorId = titleHasErrors ? 'title-error' : undefined
	const contentHasErrors = Boolean(fieldErrors?.content?.length)
	const contentErrorId = contentHasErrors ? 'content-error' : undefined

	useFocusInvalid(formRef.current, actionData?.status === 'error')

	return (
		<div className="absolute inset-0">
			<Form
				id={formId}
				noValidate={isHydrated}
				method="post"
				className="flex h-full flex-col gap-y-4 overflow-y-auto overflow-x-hidden px-10 pb-28 pt-12"
				aria-invalid={formHasErrors || undefined}
				aria-describedby={formErrorId}
				ref={formRef}
				tabIndex={-1}
			>
				<div className="flex flex-col gap-1">
					<div>
						<Label htmlFor="note-title">Title</Label>
						<Input
							id="note-title"
							name="title"
							defaultValue={data.note.title}
							required
							maxLength={titleMaxLength}
							aria-invalid={titleHasErrors || undefined}
							aria-describedby={titleErrorId}
							autoFocus
						/>
						<div className="min-h-[32px] px-4 pb-3 pt-1">
							<ErrorList id={titleErrorId} errors={fieldErrors?.title} />
						</div>
					</div>
					<div>
						<Label htmlFor="note-content">Content</Label>
						<Textarea
							id="note-content"
							name="content"
							defaultValue={data.note.content}
							required
							maxLength={contentMaxLength}
							aria-invalid={contentHasErrors || undefined}
							aria-describedby={contentErrorId}
						/>
						<div className="min-h-[32px] px-4 pb-3 pt-1">
							<ErrorList id={contentErrorId} errors={fieldErrors?.content} />
						</div>
					</div>
				</div>
				<ErrorList id={formErrorId} errors={formErrors} />
			</Form>
			<div className={floatingToolbarClassName}>
				<Button form={formId} variant="destructive" type="reset">
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
