'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { getNote } from '@/lib/api'
import type { NoteDetail } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SkeletonNoteDetail } from '@/components/ui/Skeleton'
import { TableOfContents } from '@/components/TableOfContents'
import { ImageGallery } from '@/components/ImageGallery'
import { FavoriteButton } from '@/components/FavoriteButton'
import { useFavorites } from '@/lib/favorites'

function asArray(val: unknown): string[] {
  if (Array.isArray(val)) return val
  if (typeof val === 'string' && val.trim()) return val.split(',').map((s: string) => s.trim()).filter(Boolean)
  return []
}

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

  // Pattern 1: ![alt](url) - markdown images
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
  if (src.startsWith('http')) return src
  return `/api/images/${encodeURIComponent(src)}`
}

// Custom components for ReactMarkdown (no images - they're extracted)
const MarkdownComponents = {
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
  const id = params.id as string
  const [note, setNote] = useState<NoteDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<ExtractedImage[]>([])
  const [content, setContent] = useState<string>('')
  const { isFav, toggle } = useFavorites()

useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }
    
    let cancelled = false
    
    getNote(id)
      .then((n) => {
        if (cancelled) return
        // Redirect chunk URLs to canonical note_id URLs
        const canonicalId = n.metadata?.note_id
        if (canonicalId && canonicalId !== id) {
          router.replace(`/notes/${encodeURIComponent(canonicalId)}`)
          return
        }
        setNote(n)
        const { content: cleanedContent, images } = extractImages(n.content || '')
        setContent(cleanedContent)
        setAttachments(images)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Error loading note:', err)
        setError('Failed to load note')
        setLoading(false)
      })
      
    return () => { cancelled = true }
  }, [id])

  if (loading) {
    return <SkeletonNoteDetail />
  }

  if (error || !note) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="text-zinc-500">{error || 'Note not found'}</div>
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
        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back
      </Button>

      <div className="note-layout">
        {/* Main content */}
        <div className="note-main space-y-6">
          {/* Header Card */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                      {meta.title || 'Untitled'}
                    </h1>
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
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Created: {meta.created}
                      </div>
                    )}
                    {meta.modified && (
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Modified: {meta.modified}
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {tags.filter(t => !['handwritten', 'image-only'].includes(t)).map((tag: string) => (
                        <Link 
                          key={tag} 
                          href={`/tags/${encodeURIComponent(tag)}`}
                          className="no-underline"
                        >
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 cursor-pointer hover:bg-purple-500/20 transition-colors">
                            {tag}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Participants */}
                  {participants.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {participants.map((p: string) => (
                        <Badge key={p} variant="zinc">
                          <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          {p}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Note Content */}
          <Card>
            <CardContent className="p-6">
              <div className="markdown-body">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={MarkdownComponents}
                >
                  {content || ''}
                </ReactMarkdown>
              </div>
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
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    Attachments ({attachments.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ImageGallery
                    images={attachments.map(a => ({ src: a.src, alt: a.alt }))}
                    getImageUrl={getImageUrl}
                  />
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    {attachments.map((attachment, idx) => {
                      const imageUrl = getImageUrl(attachment.src)
                      const filename = attachment.src.split('/').pop() || `image-${idx + 1}`
                      return (
                        <div key={idx} className="space-y-2">
                          <button
                            onClick={() => {
                              const gallery = document.querySelector('[data-gallery-open]')
                              if (!gallery) {
                                const event = new CustomEvent('open-gallery', { detail: { index: idx } })
                                window.dispatchEvent(event)
                              }
                            }}
                            className="block w-full text-left group"
                          >
                            <div className="aspect-square rounded-lg border border-zinc-800 overflow-hidden bg-zinc-950 group-hover:border-zinc-700 transition-colors">
                              <img
                                src={imageUrl}
                                alt={attachment.alt || filename}
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
                </CardContent>
              </Card>
            )}

            {/* Calendar Events */}
            {note.calendar_events && note.calendar_events.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
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
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
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
