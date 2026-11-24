/** A text field from a submitted form; files and missing fields read as ''. */
export function text(form: FormData, name: string): string {
	const value = form.get(name);
	return typeof value === 'string' ? value : '';
}
