import {
	redirect,
	type DataFunctionArgs,
	type MetaFunction,
} from '@remix-run/node'
import { Form } from '@remix-run/react'
import { Button } from '#app/components/ui/button.tsx'
import { Input } from '#app/components/ui/input.tsx'
import { Label } from '#app/components/ui/label.tsx'
import { invariantResponse } from '#app/utils/misc.tsx'

export async function action({ request }: DataFunctionArgs) {
	const formData = await request.formData()
	invariantResponse(!formData.get('name'), 'Form not submitted properly')
	// we'll implement signup later
	return redirect('/')
}

export default function SignupRoute() {
	return (
		<div className="container flex min-h-full flex-col justify-center pb-32 pt-20">
			<div className="mx-auto w-full max-w-lg">
				<div className="flex flex-col gap-3 text-center">
					<h1 className="text-h1">Welcome aboard!</h1>
					<p className="text-body-md text-muted-foreground">
						Please enter your details.
					</p>
				</div>
				<Form
					method="POST"
					className="mx-auto flex min-w-[368px] max-w-sm flex-col gap-4"
				>
					<div style={{ display: 'none' }} aria-hidden>
						<label htmlFor="name-input">Please leave this field blank</label>
						<input id="name-input" name="name" type="text" />
					</div>
					<div>
						<Label htmlFor="email-input">Email</Label>
						<Input autoFocus id="email-input" name="email" type="email" />
					</div>
					<Button className="w-full" type="submit">
						Create an account
					</Button>
				</Form>
			</div>
		</div>
	)
}

export const meta: MetaFunction = () => {
	return [{ title: 'Setup Epic Notes Account' }]
}
