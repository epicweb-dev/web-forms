import { json, redirect, type DataFunctionArgs } from '@remix-run/node'
import { Form, useActionData, useLoaderData } from '@remix-run/react'
import { useEffect, useState } from 'react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { floatingToolbarClassName } from '#app/components/floating-toolbar.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Input } from '#app/components/ui/input.tsx'
import { Label } from '#app/components/ui/label.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { Textarea } from '#app/components/ui/textarea.tsx'
import { db, updateNote } from '#app/utils/db.server.ts'
import { invariantResponse, useIsSubmitting } from '#app/utils/misc.tsx'

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

type ActionErrors = {
	formErrors: Array<string>
	fieldErrors: {
		title: Array<string>
		content: Array<string>
	}
}

const titleMaxLength = 100
const contentMaxLength = 10000

export async function action({ request, params }: DataFunctionArgs) {
	invariantResponse(params.noteId, 'noteId param is required')

	const formData = await request.formData()
	const title = formData.get('title')
	const content = formData.get('content')
	invariantResponse(typeof title === 'string', 'title must be a string')
	invariantResponse(typeof content === 'string', 'content must be a string')

	const errors: ActionErrors = {
		formErrors: [],
		fieldErrors: {
			title: [],
			content: [],
		},
	}

	if (title === '') {
		errors.fieldErrors.title.push('Title is required')
	}
	if (title.length > titleMaxLength) {
		errors.fieldErrors.title.push('Title must be at most 100 characters')
	}
	if (content === '') {
		errors.fieldErrors.content.push('Content is required')
	}
	if (content.length > contentMaxLength) {
		errors.fieldErrors.content.push('Content must be at most 10000 characters')
	}

	const hasErrors =
		errors.formErrors.length ||
		Object.values(errors.fieldErrors).some(fieldErrors => fieldErrors.length)
	if (hasErrors) {
		return json({ status: 'error', errors } as const, { status: 400 })
	}

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
	// 🐨 create a ref for the form element
	const formId = 'note-editor'
	const isSubmitting = useIsSubmitting()

	const fieldErrors =
		actionData?.status === 'error' ? actionData.errors.fieldErrors : null
	const formErrors =
		actionData?.status === 'error' ? actionData.errors.formErrors : null
	const isHydrated = useHydrated()

	const formHasErrors = Boolean(formErrors?.length)
	const formErrorId = formHasErrors ? 'form-error' : undefined
	const titleHasErrors = Boolean(fieldErrors?.title.length)
	const titleErrorId = titleHasErrors ? 'title-error' : undefined
	const contentHasErrors = Boolean(fieldErrors?.content.length)
	const contentErrorId = contentHasErrors ? 'content-error' : undefined

	// 🐨 add a useEffect that focuses on the first element in the form that
	// has an error whenever the actionData changes
	//   (💰 so the dependency array should include the actionData).
	// 💰 we only care to focus on an element if:
	// - the formRef.current is truthy
	// - the actionData is in an error status
	// 🐨 if the formRef.current matches the query [aria-invalid="true"] then
	// focus on the form otherwise, run formRef.current.querySelector to find the
	// first [aria-invalid="true"] HTMLElement and focus that one instead.
	// 📜 https://mdn.io/element.matches
	// 🦺 You may need to add an instanceof HTMLElement check to be able to focus it.

	return (
		<div className="absolute inset-0">
			<Form
				id={formId}
				noValidate={isHydrated}
				method="post"
				className="flex h-full flex-col gap-y-4 overflow-y-auto overflow-x-hidden px-10 pb-28 pt-12"
				aria-invalid={formHasErrors || undefined}
				aria-describedby={formErrorId}
				// 🐨 add the form ref prop here
				// 📜 https://react.dev/reference/react/useRef#manipulating-the-dom-with-a-ref
				// 🐨 add a tabIndex={-1} here so we can programmatically focus on the form
				// 📜 https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/tabindex
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
							// 🐨 add autoFocus here
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
