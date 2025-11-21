'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { MarkdownViewer } from '@/components/viewer/markdown-viewer'
import { ArticleMetadata } from '@/components/viewer/article-metadata'
import { MarkdownEditor } from '@/components/editor/markdown-editor'
import { EditorToolbar } from '@/components/editor/editor-toolbar'
import { useStore } from '@/lib/store'
import { api } from '@/lib/api'
import { Pencil, Trash2 } from 'lucide-react'

export default function ArticlePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = use(params)
  const articlePath = slug.join('/')
  const router = useRouter()

  const currentArticle = useStore((state) => state.currentArticle)
  const setCurrentArticle = useStore((state) => state.setCurrentArticle)
  const setError = useStore((state) => state.setError)

  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Fetch article on mount
  useEffect(() => {
    const fetchArticle = async () => {
      try {
        setIsLoading(true)
        const article = await api.getArticle(articlePath)
        setCurrentArticle(article)
        setEditContent(article.content)
      } catch (error: any) {
        setError(error.message || 'Failed to load article')
        console.error('Failed to fetch article:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchArticle()
  }, [articlePath, setCurrentArticle, setError])

  const handleEdit = () => {
    if (currentArticle) {
      setEditContent(currentArticle.content)
      setIsEditing(true)
    }
  }

  const handleSave = async () => {
    if (!currentArticle) return

    try {
      setIsSaving(true)
      const updated = await api.updateArticle(articlePath, {
        content: editContent,
      })
      setCurrentArticle(updated)
      setIsEditing(false)
      setError(null)
    } catch (error: any) {
      setError(error.message || 'Failed to save article')
      console.error('Failed to save article:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    if (currentArticle) {
      setEditContent(currentArticle.content)
    }
    setIsEditing(false)
  }

  const handleDelete = async () => {
    if (!currentArticle) return

    if (!confirm(`Are you sure you want to delete "${currentArticle.title}"? This action cannot be undone.`)) {
      return
    }

    try {
      setIsDeleting(true)
      await api.deleteArticle(articlePath)
      setError(null)
      router.push('/')
    } catch (error: any) {
      setError(error.message || 'Failed to delete article')
      console.error('Failed to delete article:', error)
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <MainLayout>
        <div className="wiki-main">
          <div className="wiki-content">
            <p>Loading article...</p>
          </div>
        </div>
      </MainLayout>
    )
  }

  if (!currentArticle) {
    return (
      <MainLayout>
        <div className="wiki-main">
          <div className="wiki-content">
            <h1 className="wiki-page-title">Article Not Found</h1>
            <p>The article "{articlePath}" could not be found.</p>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="wiki-main">
        <div className="wiki-content">
          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', justifyContent: 'flex-end' }}>
            {!isEditing && (
              <>
                <button
                  onClick={handleEdit}
                  className="wiki-button"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.5rem 1rem',
                    backgroundColor: '#3366cc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '2px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  <Pencil size={16} />
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="wiki-button"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.5rem 1rem',
                    backgroundColor: '#d33',
                    color: 'white',
                    border: 'none',
                    borderRadius: '2px',
                    cursor: isDeleting ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    opacity: isDeleting ? 0.6 : 1,
                  }}
                >
                  <Trash2 size={16} />
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </>
            )}
          </div>

          {/* View mode */}
          {!isEditing && (
            <>
              <h1 className="wiki-page-title">{currentArticle.title}</h1>

              <ArticleMetadata
                author={currentArticle.author}
                createdAt={currentArticle.created_at}
                updatedAt={currentArticle.updated_at}
                updatedBy={currentArticle.updated_by}
              />

              <hr style={{ margin: '1.5rem 0', border: 'none', borderTop: '1px solid #a2a9b1' }} />

              <MarkdownViewer content={currentArticle.content} />
            </>
          )}

          {/* Edit mode */}
          {isEditing && (
            <>
              <h1 className="wiki-page-title">Editing: {currentArticle.title}</h1>

              <EditorToolbar
                onSave={handleSave}
                onCancel={handleCancel}
                isSaving={isSaving}
              />

              <MarkdownEditor
                value={editContent}
                onChange={setEditContent}
                onSave={handleSave}
              />
            </>
          )}
        </div>
      </div>
    </MainLayout>
  )
}
