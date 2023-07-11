import {
	conform,
	list,
	useFieldList,
	useFieldset,
	useForm,
	type FieldConfig,
} from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import {
	json,
	redirect,
	unstable_composeUploadHandlers,
	unstable_createFileUploadHandler,
	unstable_createMemoryUploadHandler,
	unstable_parseMultipartFormData,
	type DataFunctionArgs,
} from '@remix-run/node'
import {
	Form,
	useActionData,
	useFormAction,
	useLoaderData,
	useNavigation,
} from '@remix-run/react'
import { useRef, useState } from 'react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '~/components/error-boundary.tsx'
import { floatingToolbarClassName } from '~/components/floating-toolbar.tsx'
import { Button } from '~/components/ui/button.tsx'
import { Input } from '~/components/ui/input.tsx'
import { Label } from '~/components/ui/label.tsx'
import { StatusButton } from '~/components/ui/status-button.tsx'
import { Textarea } from '~/components/ui/textarea.tsx'
import { db } from '~/utils/db.server.ts'
import { cn } from '~/utils/misc.ts'

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

const titleMinLength = 1
const titleMaxLength = 100
const contentMinLength = 1
const contentMaxLength = 10000

const MAX_UPLOAD_SIZE = 1024 * 1024 * 3 // 3MB

const ClientImageFieldsetSchema = z.union([
	z.object({
		type: z.literal('new'),
		image: z.instanceof(File).optional(),
		altText: z.string().optional(),
	}),
	z.object({
		type: z.literal('existing'),
		id: z.string(),
		altText: z.string().optional(),
	}),
])

const ServerImageFieldsetSchema = z.union([
	z.object({
		type: z.literal('new'),
		image: z
			.object({
				filepath: z.string(),
				type: z.string(),
			})
			.optional(),
		altText: z.string().optional(),
	}),
	z.object({
		type: z.literal('existing'),
		id: z.string(),
		altText: z.string().optional(),
	}),
])

const BaseNoteEditorSchema = z.object({
	title: z.string().min(titleMinLength).max(titleMaxLength),
	content: z.string().min(contentMinLength).max(contentMaxLength),
})

const ClientNoteEditorSchema = BaseNoteEditorSchema.extend({
	images: z.array(ClientImageFieldsetSchema).optional(),
})
const ServerNoteEditorSchema = BaseNoteEditorSchema.extend({
	images: z.array(ServerImageFieldsetSchema).optional(),
})

export async function action({ request, params }: DataFunctionArgs) {
	const uploadHandler = unstable_composeUploadHandlers(
		unstable_createFileUploadHandler({ maxPartSize: MAX_UPLOAD_SIZE }),
		// parse everything else into memory
		unstable_createMemoryUploadHandler(),
	)
	const formData = await unstable_parseMultipartFormData(request, uploadHandler)

	for (const entry of formData.entries()) {
		console.log(entry)
	}

	const submission = parse(formData, {
		schema: ServerNoteEditorSchema,
		acceptMultipleErrors: () => true,
	})

	if (submission.intent !== 'submit') {
		return json({ status: 'idle', submission } as const)
	}

	if (!submission.value) {
		return json(
			{
				status: 'error',
				submission,
			} as const,
			{ status: 400 },
		)
	}
	const { title, content, images } = submission.value

	console.dir({ value: submission.value }, { depth: 6, colors: true })

	const noteImages =
		images
			?.map(image => {
				if ('id' in image) {
					return db.image.update({
						where: { id: { equals: image.id } },
						data: {
							altText: image.altText,
						},
					})
				} else if (image.image) {
					return db.image.create({
						altText: image.altText,
						filepath: image.image.filepath,
						contentType: image.image.type,
					})
				} else {
					return null
				}
			})
			.filter(Boolean) ?? []

	db.note.update({
		where: { id: { equals: params.noteId } },
		data: {
			title,
			content,
			images: noteImages,
		},
	})

	return redirect(`/users/${params.username}/notes/${params.noteId}`)
}

function ErrorList({
	id,
	errors,
}: {
	id?: string
	errors?: Array<string> | string | null
}) {
	if (!errors) return null
	errors = Array.isArray(errors) ? errors : [errors]

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

function DeleteIcon({ className }: { className: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
		>
			<title>Delete</title>
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</svg>
	)
}
export default function NoteEdit() {
	const data = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()
	const navigation = useNavigation()
	const formAction = useFormAction()
	const isSubmitting =
		navigation.state !== 'idle' &&
		navigation.formMethod === 'post' &&
		navigation.formAction === formAction

	const [form, fields] = useForm({
		id: 'note-editor',
		constraint: getFieldsetConstraint(ClientNoteEditorSchema),
		lastSubmission: actionData?.submission,
		onValidate({ formData }) {
			return parse(formData, { schema: ClientNoteEditorSchema })
		},
		defaultValue: {
			title: data.note?.title,
			content: data.note?.content,
			images: data.note?.images.map(i => ({ ...i, type: 'existing' })) ?? [],
		},
	})
	const imageList = useFieldList(form.ref, fields.images)
	console.log({ form, fields, imageList })

	return (
		<div className="absolute inset-0">
			<Form
				method="post"
				className="flex h-full flex-col gap-y-4 overflow-y-auto overflow-x-hidden px-10 pb-28 pt-12"
				aria-invalid={Boolean(form.errors.length) || undefined}
				aria-describedby={form.errors.length ? form.errorId : undefined}
				encType="multipart/form-data"
				{...form.props}
			>
				{/*
					This hidden submit button is here to ensure that when the user hits
					"enter" on an input field, the primary form function is submitted
					rather than the first button in the form (which is delete/add image).
				*/}
				<button type="submit" className="hidden" />
				<div className="flex flex-col gap-1">
					<div>
						<Label htmlFor="note-title">Title</Label>
						<Input
							id="note-title"
							autoFocus
							{...conform.input(fields.title, { ariaAttributes: true })}
						/>
						<div className="min-h-[32px] px-4 pb-3 pt-1">
							<ErrorList
								id={fields.title.errorId}
								errors={fields.title.errors}
							/>
						</div>
					</div>
					<div>
						<Label htmlFor="note-content">Content</Label>
						<Textarea
							id="note-content"
							{...conform.textarea(fields.content, { ariaAttributes: true })}
						/>
						<div className="min-h-[32px] px-4 pb-3 pt-1">
							<ErrorList
								id={fields.content.errorId}
								errors={fields.content.errors}
							/>
						</div>
					</div>
					<div>
						<Label htmlFor="new-note-images">Images</Label>
						<ul className="flex flex-col gap-4">
							{imageList.map((image, index) => (
								<li
									key={image.key}
									className="relative border-b-2 border-muted-foreground px-2"
								>
									<button
										className="absolute right-0 top-0 text-destructive"
										{...list.remove(fields.images.name, { index })}
									>
										<DeleteIcon className="h-4 w-4" />
									</button>
									<ImageChooser config={image} />
								</li>
							))}
						</ul>
					</div>
					<Button
						className="mt-3"
						{...list.append(fields.images.name, { defaultValue: null })}
					>
						<AddIcon className="h-5 w-5" /> Image
					</Button>
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

function AddIcon({ className }: { className: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
		>
			<line x1="12" y1="5" x2="12" y2="19" />
			<line x1="5" y1="12" x2="19" y2="12" />
		</svg>
	)
}

function ImageChooser({
	config,
}: {
	config: FieldConfig<z.infer<typeof ClientImageFieldsetSchema>>
}) {
	const ref = useRef<HTMLFieldSetElement>(null)
	const fields = useFieldset(ref, config)
	const existingImage = fields.type.defaultValue === 'existing'
	const [previewImage, setPreviewImage] = useState<string | null>(
		existingImage ? `/resources/images/${fields.id.defaultValue}` : null,
	)
	const [altText, setAltText] = useState(fields.altText.defaultValue ?? '')

	return (
		<fieldset ref={ref} form={config.form}>
			<input
				{...conform.input(fields.type)}
				type="hidden"
				defaultValue={undefined}
				value={existingImage ? 'existing' : 'new'}
			/>
			<div className="flex gap-3">
				<div className="w-32">
					<div className="relative h-32 w-32">
						<label
							htmlFor={existingImage ? fields.id.id : fields.image.id}
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
								<div className="flex h-32 w-32 items-center justify-center rounded-lg border border-muted-foreground text-muted-foreground">
									<AddIcon className="h-24 w-24" />
								</div>
							)}
							{existingImage ? (
								<input
									{...conform.input(fields.id, { ariaAttributes: true })}
									type="hidden"
								/>
							) : (
								<input
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
									{...conform.input(fields.image, { ariaAttributes: true })}
									type="file"
								/>
							)}
						</label>
					</div>
					<div className="min-h-[32px] px-4 pb-3 pt-1">
						<ErrorList id={fields.image.errorId} errors={fields.image.errors} />
					</div>
				</div>
				<div className="flex-1">
					<Label htmlFor={fields.altText.id}>Alt Text</Label>
					<Textarea
						onChange={e => setAltText(e.currentTarget.value)}
						{...conform.input(fields.altText, { ariaAttributes: true })}
					/>
					<div className="min-h-[32px] px-4 pb-3 pt-1">
						<ErrorList
							id={fields.altText.errorId}
							errors={fields.altText.errors}
						/>
					</div>
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
