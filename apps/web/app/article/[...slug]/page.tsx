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
import type { RepositoryStatus } from '@/types/api'

/**
 * Parse article path from slug segments
 * Handles both multi-repo mode (/article/{repo_id}/path/to/file.md)
 * and single-repo mode (/article/path/to/file.md)
 *
 * Returns [repositoryId, articlePath] where repositoryId is undefined in single-repo mode
 */
function parseArticlePath(slug: string[]): [string | undefined, string] {
  if (slug.length === 0) {
    return [undefined, '']
  }

  // Check if the first segment looks like a repository ID (owner/repo format)
  const firstSegment = slug[0]
  if (firstSegment.includes('/') && slug.length > 1) {
    // Multi-repo mode: first segment is repo ID, rest is path
    const repositoryId = firstSegment
    const articlePath = slug.slice(1).join('/')
    return [repositoryId, articlePath]
  }

  // Single-repo mode: entire slug is the article path
  const articlePath = slug.join('/')
  return [undefined, articlePath]
}

export default function ArticlePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()

  // Parse repository ID from slug if present (multi-repo mode)
  // URL structure: /article/{repo_id}/path/to/file.md or /article/path/to/file.md
  const [repositoryId, articlePath] = parseArticlePath(slug)

  const currentArticle = useStore((state) => state.currentArticle)
  const setCurrentArticle = useStore((state) => state.setCurrentArticle)

  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [initialEditContent, setInitialEditContent] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [repository, setRepository] = useState<RepositoryStatus | null>(null)
  const [isReadOnly, setIsReadOnly] = useState(false)

  // Fetch repository details and article on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)

        // Fetch repository details if repository ID is present
        if (repositoryId) {
          try {
            const repo = await api.getRepository(repositoryId)
            setRepository(repo)
            setIsReadOnly(repo.read_only)
          } catch (error: any) {
            console.error('Failed to fetch repository:', error)
            toast.error('Repository not found')
            // Continue to try loading article even if repo fetch fails
          }
        }

        const article = await api.getArticle(articlePath)
        setCurrentArticle(article)
        setEditContent(article.content)
        setInitialEditContent(article.content)

        // Check if we should auto-enter edit mode (only if not read-only)
        const shouldEdit = searchParams?.get('edit') === 'true'
        if (shouldEdit && !isReadOnly) {
          setIsEditing(true)
          // Remove the query parameter from URL
          const fullPath = repositoryId ? `${repositoryId}/${articlePath}` : articlePath
          router.replace(`/article/${fullPath}`)
        }
      } catch (error: any) {
        toast.error(error.message || 'Failed to load article')
        console.error('Failed to fetch article:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
    // searchParams and router are stable references and don't need to be in dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articlePath, repositoryId, setCurrentArticle])

  const handleEdit = () => {
    if (currentArticle && !isReadOnly) {
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
      onEdit={!isEditing && !isReadOnly ? handleEdit : undefined}
      showEditButton={!isEditing}
      isReadOnly={isReadOnly}
      repository={repository}
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
      {isEditing && !isReadOnly && (
        <div className="fixed inset-0 bg-white z-40 flex flex-col">
          <MarkdownEditor
            value={editContent}
            onChange={setEditContent}
            onSave={handleSave}
            onCancel={handleCancel}
            initialValue={initialEditContent}
            isReadOnly={isReadOnly}
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
