export const STRUCTURAL_TAGS = [
  '1:1', 'interview', 'work', 'personal', 'notes', 'zeig',
  'evernote', 'zendesk', 'enova', 'skitch', 'alanzoppas-notebook',
  'artificial-memory', 'chinese', 'hindi', 'household',
  'personal-receipts', 'stories', 'werk', 'aperture',
  'interview-notes', 'journal', 'raven', 'handwritten', 'image-only',
]

export const asArray = (val: unknown): string[] => {
  if (Array.isArray(val)) return val.map(String)
  if (typeof val === 'string' && val.trim()) return val.split(',').map((s: string) => s.trim()).filter(Boolean)
  return []
}
