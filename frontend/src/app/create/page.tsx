'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { PersonInput } from '@/components/PersonInput'
import { MultiTagInput } from '@/components/ui/MultiTagInput'
import { useCreateNote, tagKeys, tagsApi, schemaApi, peopleApi } from '@/lib/queries'

export default function CreateNotePage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [folder, setFolder] = useState('Notes')
  const [tags, setTags] = useState<string[]>([])
  const [participants, setParticipants] = useState<string[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: tagsData } = useQuery({ queryKey: tagKeys.all, queryFn: tagsApi.all })
  const allTags = tagsData?.tags ?? []

  const { data: schemaData } = useQuery({ queryKey: ['schema'], queryFn: schemaApi.get })
  const folders = schemaData?.folders ?? []

  const { data: peopleData } = useQuery({ queryKey: ['people'], queryFn: peopleApi.all })
  const people = peopleData ?? []

  const createMutation = useCreateNote()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}

    if (!title.trim()) {
      newErrors.title = 'Title is required'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    createMutation.mutate(
      {
        title: title.trim(),
        content,
        folder,
        tags,
        participants,
      },
      {
        onSuccess: (result) => {
          router.push(`/notes/${result.id}`)
        },
      }
    )
  }

  const folderOptions = folders.map((f) => ({ value: f, label: f }))

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <SectionHeader
        title="New Note"
        description="Create a new note in your archive"
      />

      <Card>
        <CardContent className="space-y-5">
          <form onSubmit={handleSubmit}>
            <div className="space-y-5">
              <Input
                label="Title"
                required
                placeholder="Note title..."
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  if (errors.title) {
                    setErrors((prev) => {
                      const next = { ...prev }
                      delete next.title
                      return next
                    })
                  }
                }}
                error={errors.title}
                data-testid="create-title"
              />

              <Textarea
                label="Content"
                placeholder="Write your note..."
                rows={15}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="font-mono text-sm"
                data-testid="create-content"
              />

              <Select
                label="Folder"
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                options={folderOptions}
                data-testid="create-folder"
              />

              <MultiTagInput
                label="Tags"
                selectedTags={tags}
                allTags={allTags}
                onChange={setTags}
                placeholder="Add tag..."
              />

              <PersonInput
                participants={participants}
                people={people}
                onChange={setParticipants}
              />

              {createMutation.isError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {createMutation.error?.message || 'Failed to create note'}
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  loading={createMutation.isPending}
                  data-testid="create-submit"
                >
                  Create Note
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => router.back()}
                  data-testid="create-cancel"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
