'use client'

import { useState, useMemo, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Calendar, Clock, Loader2, Check, Pencil, Paperclip, Zap } from 'lucide-react'
import {
  noteKeys, notesApi,
  tagKeys, tagsApi,
  peopleKeys, peopleApi,
  notesMutations,
} from '@/lib/queries'
import type { NoteDetail } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SkeletonNoteDetail } from '@/components/ui/Skeleton'
import { TableOfContents } from '@/components/TableOfContents'
import { ImageGallery } from '@/components/ImageGallery'
import { FavoriteButton } from '@/components/FavoriteButton'
import { EditableTitle } from '@/components/EditableTitle'
import { TagInput } from '@/components/TagInput'
import { PersonInput } from '@/components/PersonInput'
import { useFavorites } from '@/lib/favorites'
import { asArray } from '@/lib/constants'

// Extract images from markdown content
interface ExtractedImage {
  src: string
  alt?: string
  type: 'inline' | 'link'
  original: string
}

function extractImages(content: string): { content: string; images: ExtractedImage[] } {
  const images: ExtractedImage[] = []
  let cleanedContent = content

  // Pattern 0: Reference definitions [ref]: <url> — extract data: URIs (embedded images)
  const refDefinitions: Record<string, string> = {}
  cleanedContent = cleanedContent.replace(/^\[([^\]]+)\]:\s*<(data:[^>]+)>\s*$/gm, (_, ref, url) => {
    refDefinitions[ref.toLowerCase()] = url
    return ''
  })

  // Pattern 0b: Reference-style images ![alt][ref] using extracted definitions
  cleanedContent = cleanedContent.replace(/!\[([^\]]*)\]\[([^\]]+)\]/g, (match, alt, ref) => {
    const url = refDefinitions[ref.toLowerCase()]
    if (url) {
      images.push({ src: url, alt, type: 'inline', original: match })
    }
    return ''
  })

  // Pattern 1: ![alt](url) - inline markdown images
  const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
  cleanedContent = cleanedContent.replace(imgRegex, (match, alt, src) => {
    const normalized = src.replace(/^\.\.\//, '').replace(/^\.\//, '')
    images.push({ src: normalized, alt, type: 'inline', original: match })
    return ''
  })

  // Pattern 2: [View original](url) - links to images
  const linkRegex = /\[View original\]\(([^)]+\.(?:png|jpg|jpeg|gif|bmp|webp))\)/gi
  cleanedContent = cleanedContent.replace(linkRegex, (match, src) => {
    const normalized = src.replace(/^\.\.\//, '').replace(/^\.\//, '')
    images.push({ src: normalized, alt: 'View original', type: 'link', original: match })
    return ''
  })

  // Pattern 3: <img src="..."> - HTML images
  const htmlImgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  cleanedContent = cleanedContent.replace(htmlImgRegex, (match, src) => {
    const altMatch = match.match(/alt=["']([^"]*)["']/)
    const normalized = src.replace(/^\.\.\//, '').replace(/^\.\//, '')
    images.push({ src: normalized, alt: altMatch?.[1], type: 'inline', original: match })
    return ''
  })

  // Clean up multiple consecutive newlines
  cleanedContent = cleanedContent.replace(/\n{3,}/g, '\n\n')

  return { content: cleanedContent, images }
}

function getImageUrl(src: string): string {
  if (src.startsWith('http') || src.startsWith('data:')) return src
  return `/api/images/${encodeURIComponent(src)}`
}

// Custom components for ReactMarkdown (no images - they're extracted)
const MarkdownComponents = {
  img: ({ src, alt }: { src?: string | Blob; alt?: string }) => {
    if (!src || typeof src !== 'string') return null
    return <img src={src} alt={alt || ''} loading="lazy" className="max-w-full h-auto rounded" />
  },
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
    return <a href={href} className="text-blue-400 hover:text-blue-300 transition-colors">{children}</a>
  },
  h1: ({ children, id }: { children?: React.ReactNode; id?: string }) => {
    const text = typeof children === 'string' ? children : ''
    const headingId = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 50)
    return <h1 id={headingId} className="scroll-mt-20">{children}</h1>
  },
  h2: ({ children, id }: { children?: React.ReactNode; id?: string }) => {
    const text = typeof children === 'string' ? children : ''
    const headingId = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 50)
    return <h2 id={headingId} className="scroll-mt-20">{children}</h2>
  },
  h3: ({ children, id }: { children?: React.ReactNode; id?: string }) => {
    const text = typeof children === 'string' ? children : ''
    const headingId = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 50)
    return <h3 id={headingId} className="scroll-mt-20">{children}</h3>
  }
}

export default function NotePage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const id = params.id as string

  const [editing, setEditing] = useState(false)
  const [editDraft, setEditDraft] = useState<string>('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const { isFav, toggle } = useFavorites()
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState(0)

  // Queries
  const {
    data: note,
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: noteKeys.detail(id),
    queryFn: () => notesApi.detail(id),
    enabled: !!id,
  });

  // Redirect chunk URLs → canonical note_id
  const canonicalId = note?.metadata?.note_id
  useEffect(() => {
    if (canonicalId && canonicalId !== id) {
      router.replace(`/notes/${encodeURIComponent(canonicalId)}`)
    }
  }, [canonicalId, id, router])

  // Derived state from note
  const { content, attachments } = useMemo(() => {
    if (!note) return { content: '', attachments: [] as ExtractedImage[] };
    const { content: cleanedContent, images } = extractImages(note.content || '');
    return { content: cleanedContent, attachments: images };
  }, [note]);

  const { data: tagsData } = useQuery({
    queryKey: tagKeys.all,
    queryFn: tagsApi.all,
    staleTime: Infinity,
  });
  const allTagNames = tagsData?.tags?.map((t) => t.name) ?? [];

  const { data: peopleData } = useQuery({
    queryKey: peopleKeys.all,
    queryFn: peopleApi.all,
    staleTime: Infinity,
  });
  const allPeople = peopleData ?? [];

  // Mutations
  const updateMutation = useMutation({
    mutationFn: notesMutations.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteKeys.detail(id) });
      setEditing(false);
      setEditSaving(false);
    },
    onError: (e: any) => {
      setEditError(e?.message || 'Failed to save');
      setEditSaving(false);
    },
  });

  const handleStartEdit = () => {
    setEditDraft(note?.content || '')
    setEditError(null)
    setEditing(true)
  }

  const handleSaveEdit = async () => {
    if (!note) return
    const nid = note.metadata?.note_id || note.id
    setEditSaving(true)
    setEditError(null)
    updateMutation.mutate({ id: nid, data: { content: editDraft } })
  }

  const handleCancelEdit = () => {
    setEditDraft('')
    setEditError(null)
    setEditing(false)
  }

  const handleUpdateField = async (field: string, value: any) => {
    if (!note) return;
    const nid = note.metadata?.note_id || note.id;
    await updateMutation.mutateAsync({ id: nid, data: { [field]: value } });
  };

  if (loading) {
    return <SkeletonNoteDetail />
  }

  if (error || !note) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="text-zinc-500">{error?.message || 'Note not found'}</div>
        <Button variant="secondary" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    )
  }

  const meta = note.metadata || {}
  const tags = asArray(meta.tags)
  const participants = asArray(meta.participants)
  const isHandwritten = tags.includes('handwritten')
  const noteId = meta.note_id || note.id

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => router.back()} className="-ml-2">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>

      <div className="note-layout">
        {/* Main content */}
        <div className="note-main space-y-6">
          {/* Header Card */}
          <Card className="relative z-10">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <EditableTitle
                      value={meta.title || 'Untitled'}
                      onSave={(newTitle) => handleUpdateField('title', newTitle)}
                    />
                    <FavoriteButton noteId={noteId} isFavorite={isFav(noteId)} onToggle={toggle} />
                  </div>

                  {/* Metadata badges */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {meta.folder && (
                      <Badge variant="zinc">{meta.folder}</Badge>
                    )}
                    <Badge variant={meta.source === 'Evernote' ? 'green' : 'blue'}>
                      {meta.source || 'Unknown'}
                    </Badge>
                    {isHandwritten && (
                      <Badge variant="amber">Handwritten</Badge>
                    )}
                  </div>

                  {/* Dates */}
                  <div className="text-sm text-zinc-500 space-y-1">
                    {meta.created && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Created: {meta.created}
                      </div>
                    )}
                    {meta.modified && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Modified: {meta.modified}
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  <TagInput
                    tags={tags}
                    allTags={allTagNames}
                    onChange={(newTags) => handleUpdateField('tags', newTags)}
                  />

                  {/* Participants */}
                  <PersonInput
                    participants={participants}
                    people={allPeople}
                    onChange={(newParticipants) => handleUpdateField('participants', newParticipants)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Note Content */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                {editing ? 'Editing' : 'Content'}
              </CardTitle>
              <div className="flex items-center gap-2">
                {editing ? (
                  <>
                    <button
                      onClick={handleSaveEdit}
                      disabled={editSaving}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {editSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      disabled={editSaving}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleStartEdit}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-sm font-medium transition-colors border border-zinc-700"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {editing ? (
                <>
                  <textarea
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    disabled={editSaving}
                    className="w-full min-h-[400px] bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-zinc-100 font-mono text-sm leading-relaxed resize-y focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                  />
                  {editError && (
                    <p className="text-red-400 text-sm mt-2">{editError}</p>
                  )}
                </>
              ) : (
                <div className="markdown-body">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                    components={MarkdownComponents}
                  >
                    {content || ''}
                  </ReactMarkdown>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="note-sidebar">
          <div className="sticky top-6 space-y-6">
            {/* Table of Contents */}
            <Card>
              <CardContent className="p-4">
                <TableOfContents content={content} />
              </CardContent>
            </Card>

            {/* Attachments */}
            {attachments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Paperclip className="w-4 h-4" />
                    Attachments ({attachments.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ImageGallery
                    images={attachments.map(a => ({ src: a.src, alt: a.alt }))}
                    getImageUrl={getImageUrl}
                    externalOpen={galleryOpen}
                    externalIndex={galleryIndex}
                    onOpenChange={setGalleryOpen}
                    onIndexChange={setGalleryIndex}
                  />
                  {attachments.length === 1 ? (
                    // Single image: full width with proper aspect ratio
                    <div
                      onClick={() => {
                        setGalleryIndex(0)
                        setGalleryOpen(true)
                      }}
                      className="cursor-zoom-in group"
                    >
                      <div className="rounded-lg border border-zinc-800 overflow-hidden bg-zinc-950 group-hover:border-zinc-700 transition-colors">
                        <img
                          src={getImageUrl(attachments[0].src)}
                          alt={attachments[0].alt || attachments[0].src.split('/').pop() || 'Attachment'}
                          loading="lazy"
                          className="w-full h-auto object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      </div>
                      <p className="text-xs text-zinc-500 mt-2 truncate group-hover:text-zinc-400">
                        {attachments[0].src.split('/').pop() || 'image-1'}
                      </p>
                    </div>
                  ) : (
                    // Multiple images: grid layout
                    <div className="grid grid-cols-2 gap-3">
                      {attachments.map((attachment, idx) => {
                        const imageUrl = getImageUrl(attachment.src)
                        const filename = attachment.src.split('/').pop() || `image-${idx + 1}`
                        return (
                          <div key={idx} className="space-y-2">
                            <button
                              onClick={() => {
                                setGalleryIndex(idx)
                                setGalleryOpen(true)
                              }}
                              className="block w-full text-left group"
                            >
                              <div className="aspect-square rounded-lg border border-zinc-800 overflow-hidden bg-zinc-950 group-hover:border-zinc-700 transition-colors">
                                <img
                                  src={imageUrl}
                                  alt={attachment.alt || filename}
                                  loading="lazy"
                                  className="w-full h-full object-cover cursor-zoom-in"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none'
                                  }}
                                />
                              </div>
                              <p className="text-xs text-zinc-500 mt-1 truncate group-hover:text-zinc-400">
                                {filename}
                              </p>
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Calendar Events */}
            {note.calendar_events && note.calendar_events.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Same-day Events
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {note.calendar_events.map((event) => (
                      <div key={event.id} className="text-sm border-l-2 border-blue-500/30 pl-3">
                        <div className="font-medium text-zinc-200">{event.summary}</div>
                        {event.start && (
                          <div className="text-zinc-500 text-xs mt-1">
                            {new Date(event.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                        {event.location && (
                          <div className="text-zinc-500 text-xs">{event.location}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Similar Notes */}
            {note.similar_notes && note.similar_notes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Similar Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {note.similar_notes.slice(0, 5).map((n) => (
                      <Link
                        key={n.id}
                        href={`/notes/${encodeURIComponent(n.note_id || n.id)}`}
                        style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.5rem' }}
                        className="text-sm font-medium py-1.5 text-zinc-300 hover:text-zinc-100 transition-colors group no-underline"
                      >
                        <span className="break-words min-w-0">{n.title}</span>
                        <span className="shrink-0 text-zinc-500 text-xs group-hover:text-zinc-400 flex items-baseline gap-2">
                          {n.created && (
                            <span>{new Date(n.created).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })}</span>
                          )}
                          {typeof n.score === 'number' && <span>{(n.score * 100).toFixed(0)}%</span>}
                        </span>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
