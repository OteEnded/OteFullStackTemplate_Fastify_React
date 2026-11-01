// Join class names, skipping falsy ones. The whole of clsx this template needs.
export function cx(...parts: Array<string | false | null | undefined | 0>): string {
  return parts.filter(Boolean).join(' ')
}
