'use client'

import { use, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { MainLayout } from '@/components/layout/main-layout'
import { MarkdownViewer } from '@/components/viewer/markdown-viewer'
import { ArticleMetadata } from '@/components/viewer/article-metadata'
import { MarkdownEditor } from '@/components/editor/markdown-editor'
import { useStore } from '@/lib/store'
import { api } from '@/lib/api'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

export default function ArticlePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = use(params)
  const articlePath = slug.join('/')
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentArticle = useStore((state) => state.currentArticle)
  const setCurrentArticle = useStore((state) => state.setCurrentArticle)

  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [initialEditContent, setInitialEditContent] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Fetch article on mount
  useEffect(() => {
    const fetchArticle = async () => {
      try {
        setIsLoading(true)
        const article = await api.getArticle(articlePath)
        setCurrentArticle(article)
        setEditContent(article.content)
        setInitialEditContent(article.content)

        // Check if we should auto-enter edit mode
        const shouldEdit = searchParams?.get('edit') === 'true'
        if (shouldEdit) {
          setIsEditing(true)
          // Remove the query parameter from URL
          router.replace(`/article/${articlePath}`)
        }
      } catch (error: any) {
        toast.error(error.message || 'Failed to load article')
        console.error('Failed to fetch article:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchArticle()
    // searchParams and router are stable references and don't need to be in dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articlePath, setCurrentArticle])

  const handleEdit = () => {
    if (currentArticle) {
      setEditContent(currentArticle.content)
      setInitialEditContent(currentArticle.content)
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
      toast.success('Article saved successfully')
    } catch (error: any) {
      toast.error(error.message || 'Failed to save article')
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

  const handleDelete = () => {
    if (!currentArticle) return
    setShowDeleteConfirm(true)
  }

  const confirmDelete = async () => {
    if (!currentArticle) return

    try {
      setIsDeleting(true)
      await api.deleteArticle(articlePath)
      toast.success('Article deleted successfully')
      router.push('/')
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete article')
      console.error('Failed to delete article:', error)
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  // Generate breadcrumbs from article path
  const breadcrumbs = currentArticle
    ? articlePath.split('/').map((segment, index, array) => ({
        label: segment.replace(/-/g, ' ').replace(/\.md$/, ''),
        href: index < array.length - 1 ? `/article/${array.slice(0, index + 1).join('/')}` : undefined
      }))
    : [];

  if (isLoading) {
    return (
      <MainLayout>
        <p className="text-gray-600">Loading article...</p>
      </MainLayout>
    )
  }

  if (!currentArticle) {
    return (
      <MainLayout breadcrumbs={[{ label: 'Article Not Found' }]}>
        <h1 className="text-4xl font-bold text-gray-900 tracking-tighter mb-6 mt-2 pb-4 border-b border-gray-100">
          Article Not Found
        </h1>
        <p className="text-gray-600">The article "{articlePath}" could not be found.</p>
      </MainLayout>
    )
  }

  return (
    <MainLayout
      breadcrumbs={breadcrumbs}
      onEdit={!isEditing ? handleEdit : undefined}
      showEditButton={!isEditing}
    >
      {/* View mode */}
      {!isEditing && (
        <>
          <MarkdownViewer content={currentArticle.content} />

          <hr className="my-8 border-0 border-t border-gray-200" />

          <ArticleMetadata
            author={currentArticle.author}
            createdAt={currentArticle.created_at}
            updatedAt={currentArticle.updated_at}
            updatedBy={currentArticle.updated_by}
          />
        </>
      )}

      {/* Edit mode */}
      {isEditing && (
        <div className="fixed inset-0 bg-white z-40 flex flex-col">
          <MarkdownEditor
            value={editContent}
            onChange={setEditContent}
            onSave={handleSave}
            onCancel={handleCancel}
            initialValue={initialEditContent}
          />
        </div>
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Article"
        description={`Are you sure you want to delete "${currentArticle?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </MainLayout>
  )
}
