import { conform, useForm, report } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import {
	unstable_createMemoryUploadHandler as createMemoryUploadHandler,
	json,
	unstable_parseMultipartFormData as parseMultipartFormData,
	redirect,
	type DataFunctionArgs,
} from '@remix-run/node'
import { Form, useActionData, useLoaderData } from '@remix-run/react'
import { useState } from 'react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '~/components/error-boundary.tsx'
import { floatingToolbarClassName } from '~/components/floating-toolbar.tsx'
import { Button } from '~/components/ui/button.tsx'
import { Input } from '~/components/ui/input.tsx'
import { Label } from '~/components/ui/label.tsx'
import { StatusButton } from '~/components/ui/status-button.tsx'
import { Textarea } from '~/components/ui/textarea.tsx'
import { db, updateNote } from '~/utils/db.server.ts'
import { cn, invariantResponse, useIsSubmitting } from '~/utils/misc.ts'

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
		note: {
			title: note.title,
			content: note.content,
			images: note.images.map(i => ({ id: i.id, altText: i.altText })),
		},
	})
}

const titleMaxLength = 100
const contentMaxLength = 10000

const MAX_UPLOAD_SIZE = 1024 * 1024 * 3 // 3MB

// 🐨 make a ImageFieldsetSchema that's an object which has id, file, and altText

const NoteEditorSchema = z.object({
	title: z.string().max(titleMaxLength),
	content: z.string().max(contentMaxLength),
	// 🐨 move these three properties to the ImageFieldsetSchema
	imageId: z.string().optional(),
	file: z
		.instanceof(File)
		.refine(file => {
			return file.size <= MAX_UPLOAD_SIZE
		}, 'File size must be less than 3MB')
		.optional(),
	altText: z.string().optional(),
	// 🐨 add an image property that's assigned to the ImageFieldsetSchema
})

export async function action({ request, params }: DataFunctionArgs) {
	invariantResponse(params.noteId, 'noteId param is required')

	const formData = await parseMultipartFormData(
		request,
		createMemoryUploadHandler({ maxPartSize: MAX_UPLOAD_SIZE }),
	)

	const submission = parse(formData, {
		schema: NoteEditorSchema,
	})

	if (!submission.value) {
		return json({ status: 'error', submission: report(submission) } as const, {
			status: 400,
		})
	}
	// 🐨 just grab the "image" instead of file, imageId, and altText
	const { title, content, file, imageId, altText } = submission.value

	await updateNote({
		id: params.noteId,
		title,
		content,
		// 🐨 just pass the image in the array instead of constructing an object here
		images: [{ file, id: imageId, altText }],
	})

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
				<li key={i} className="text-[10px] text-foreground-danger">
					{error}
				</li>
			))}
		</ul>
	) : null
}

export default function NoteEdit() {
	const data = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()
	const isSubmitting = useIsSubmitting()

	const [form, fields] = useForm({
		id: 'note-editor',
		constraint: getFieldsetConstraint(NoteEditorSchema),
		lastSubmission: actionData?.submission,
		onValidate({ formData }) {
			return parse(formData, { schema: NoteEditorSchema })
		},
		defaultValue: {
			title: data.note.title,
			content: data.note.content,
			// 🐨 add a default value for the image
			// 💰 data.note.images[0]
			// you'll be referencing the default values in the component below.
		},
	})

	return (
		<div className="absolute inset-0">
			<Form
				method="post"
				className="flex h-full flex-col gap-y-4 overflow-y-auto overflow-x-hidden px-10 pb-28 pt-12"
				{...form.props}
				encType="multipart/form-data"
			>
				<div className="flex flex-col gap-1">
					<div>
						<Label htmlFor={fields.title.id}>Title</Label>
						<Input autoFocus {...conform.input(fields.title)} />
						<div className="min-h-[32px] px-4 pb-3 pt-1">
							<ErrorList
								id={fields.title.errorId}
								errors={fields.title.errors}
							/>
						</div>
					</div>
					<div>
						<Label htmlFor={fields.content.id}>Content</Label>
						<Textarea {...conform.textarea(fields.content)} />
						<div className="min-h-[32px] px-4 pb-3 pt-1">
							<ErrorList
								id={fields.content.errorId}
								errors={fields.content.errors}
							/>
						</div>
					</div>
					<div>
						<Label>Image</Label>
						{/* 🐨 pass the fields.image config instead of the image itself */}
						<ImageChooser image={data.note.images[0]} />
					</div>
				</div>
				<ErrorList id={form.errorId} errors={form.errors} />
			</Form>
			<div className={floatingToolbarClassName}>
				<Button form={form.id} variant="destructive" type="reset">
					Reset
				</Button>
				<StatusButton
					form={form.id}
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

function ImageChooser({
	image,
}: {
	// 🐨 change this prop to "config" which is Conform FieldConfig of the ImageFieldsetSchema
	image?: { id: string; altText?: string | null }
}) {
	// 🐨 create a ref for the fieldset
	// 🐨 create a conform fields object with useFieldset

	// 🐨 the existingImage should now be based on whether fields.id.defaultValue is set
	const existingImage = Boolean(image)
	const [previewImage, setPreviewImage] = useState<string | null>(
		// 🐨 this should now reference fields.id.defaultValue
		existingImage ? `/resources/images/${image?.id}` : null,
	)
	// 🐨 this should now reference fields.altText.defaultValue
	const [altText, setAltText] = useState(image?.altText ?? '')

	return (
		// 🐨 pass the ref prop to fieldset
		<fieldset>
			<div className="flex gap-3">
				<div className="w-32">
					<div className="relative h-32 w-32">
						<label
							// 🐨 update this htmlFor to reference fields.id.id
							htmlFor="image-input"
							className={cn('group absolute h-32 w-32 rounded-lg', {
								'bg-accent opacity-40 focus-within:opacity-100 hover:opacity-100':
									!previewImage,
								'cursor-pointer focus-within:ring-4': !existingImage,
							})}
						>
							{previewImage ? (
								<div className="relative">
									<img
										src={previewImage}
										alt={altText ?? ''}
										className="h-32 w-32 rounded-lg object-cover"
									/>
									{existingImage ? null : (
										<div className="pointer-events-none absolute -right-0.5 -top-0.5 rotate-12 rounded-sm bg-secondary px-2 py-1 text-xs text-secondary-foreground shadow-md">
											new
										</div>
									)}
								</div>
							) : (
								<div className="flex h-32 w-32 items-center justify-center rounded-lg border border-muted-foreground text-4xl text-muted-foreground">
									➕
								</div>
							)}
							{existingImage ? (
								// 🐨 update this to use the conform.input helper on
								// fields.image.id (make sure it stays hidden though)
								<input name="imageId" type="hidden" value={image?.id} />
							) : null}
							<input
								// 💣 remove this id
								id="image-input"
								aria-label="Image"
								className="absolute left-0 top-0 z-0 h-32 w-32 cursor-pointer opacity-0"
								onChange={event => {
									const file = event.target.files?.[0]

									if (file) {
										const reader = new FileReader()
										reader.onloadend = () => {
											setPreviewImage(reader.result as string)
										}
										reader.readAsDataURL(file)
									} else {
										setPreviewImage(null)
									}
								}}
								// 💣 remove the name and type props
								name="file"
								type="file"
								accept="image/*"
								// 🐨 add the props from conform.input with the fields.file
							/>
						</label>
					</div>
				</div>
				<div className="flex-1">
					{/* 🐨 update this htmlFor to reference fields.altText.id */}
					<Label htmlFor="alt-text">Alt Text</Label>
					<Textarea
						// 💣 remove the id, name, and defaultValue
						id="alt-text"
						name="altText"
						defaultValue={altText}
						onChange={e => setAltText(e.currentTarget.value)}
						// 🐨 add the props from conform.textarea with the fields.altText
					/>
				</div>
			</div>
		</fieldset>
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
