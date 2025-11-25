'use client'

import { use, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { MainLayout } from '@/components/layout/main-layout'
import { MarkdownViewer } from '@/components/viewer/markdown-viewer'
import { CodeViewer } from '@/components/viewer/code-viewer'
import { ArticleMetadata } from '@/components/viewer/article-metadata'
import { MarkdownEditor } from '@/components/editor/markdown-editor'
import { useStore } from '@/lib/store'
import { api } from '@/lib/api'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import type { RepositoryStatus } from '@/types/api'

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.bmp']

/**
 * Parse article path from slug segments
 * Multi-repo mode: /{repo_id}/path/to/file.md
 *
 * Returns [repositoryId, articlePath]
 */
function parseArticlePath(slug: string[]): [string | undefined, string] {
  if (slug.length === 0) {
    return [undefined, '']
  }

  // Multi-repo mode: first segment is always the repository ID
  // Example: /transparentlyadmin-wiki-pages/Home.md
  // slug = ['transparentlyadmin-wiki-pages', 'Home.md']
  if (slug.length >= 2) {
    const repositoryId = slug[0]
    const articlePath = slug.slice(1).join('/')
    return [repositoryId, articlePath]
  }

  // Fallback for malformed URLs
  const articlePath = slug.join('/')
  return [undefined, articlePath]
}

export default function ArticlePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()

  // Parse repository ID from slug if present (multi-repo mode)
  // URL structure: /{repo_id}/path/to/file.md or /path/to/file.md
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

  // Determine file type
  const isMarkdown = articlePath.toLowerCase().endsWith('.md')
  const isImage = IMAGE_EXTENSIONS.some(ext => articlePath.toLowerCase().endsWith(ext))

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

        if (isImage) {
          // For images, we don't need to fetch content, just set dummy article data
          setCurrentArticle({
            path: articlePath,
            title: articlePath.split('/').pop() || articlePath,
            content: '', // Content not used for images
            author: null,
            created_at: null,
            updated_at: null,
            updated_by: null,
          })
        } else {
          const article = repositoryId
            ? await api.getArticle(repositoryId, articlePath)
            : await api.getArticle(articlePath)
          setCurrentArticle(article)
          setEditContent(article.content)
          setInitialEditContent(article.content)
        }

        // Check if we should auto-enter edit mode (only if not read-only and is markdown)
        const shouldEdit = searchParams?.get('edit') === 'true'
        if (shouldEdit && !isReadOnly && isMarkdown) {
          setIsEditing(true)
          // Remove the query parameter from URL
          const fullPath = repositoryId ? `${repositoryId}/${articlePath}` : articlePath
          router.replace(`/${fullPath}`)
        }
      } catch (error: any) {
        toast.error(error.message || 'Failed to load file')
        console.error('Failed to fetch file:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
    // searchParams and router are stable references and don't need to be in dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articlePath, repositoryId, setCurrentArticle, isMarkdown, isImage])

  const handleEdit = () => {
    if (currentArticle && !isReadOnly && isMarkdown) {
      setEditContent(currentArticle.content)
      setInitialEditContent(currentArticle.content)
      setIsEditing(true)
    }
  }

  const handleSave = async () => {
    if (!currentArticle) return

    try {
      setIsSaving(true)
      const updated = repositoryId
        ? await api.updateArticle(repositoryId, articlePath, { content: editContent })
        : await api.updateArticle(articlePath, { content: editContent })
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
      if (repositoryId) {
        await api.deleteArticle(repositoryId, articlePath)
      } else {
        await api.deleteArticle(articlePath)
      }
      toast.success('File deleted successfully')
      router.push('/')
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete file')
      console.error('Failed to delete file:', error)
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  // Generate breadcrumbs from article path
  const breadcrumbs = currentArticle
    ? articlePath.split('/').map((segment, index, array) => {
        const label = segment.replace(/-/g, ' ').replace(/\.md$/, '');
        const pathSegments = array.slice(0, index + 1).join('/');
        const href = index < array.length - 1
          ? repositoryId
            ? `/${repositoryId}/${pathSegments}`
            : `/${pathSegments}`
          : undefined;
        return { label, href };
      })
    : [];

  if (isLoading) {
    return (
      <MainLayout>
        <p className="text-gray-600">Loading...</p>
      </MainLayout>
    )
  }

  if (!currentArticle) {
    return (
      <MainLayout breadcrumbs={[{ label: 'Not Found' }]}>
        <h1 className="text-4xl font-bold text-gray-900 tracking-tighter mb-6 mt-2 pb-4 border-b border-gray-100">
          File Not Found
        </h1>
        <p className="text-gray-600">The file "{articlePath}" could not be found.</p>
      </MainLayout>
    )
  }

  return (
    <MainLayout
      breadcrumbs={breadcrumbs}
      onEdit={!isEditing && !isReadOnly && isMarkdown ? handleEdit : undefined}
      showEditButton={!isEditing && isMarkdown}
      isReadOnly={isReadOnly}
      repository={repository}
    >
      {/* View mode */}
      {!isEditing && (
        <>
          {isMarkdown ? (
            <MarkdownViewer content={currentArticle.content} repositoryId={repositoryId} />
          ) : isImage ? (
            <div className="flex justify-center p-4 bg-gray-50 rounded-lg border border-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={`/api/repositories/${repositoryId}/${articlePath}`} 
                alt={currentArticle.title}
                className="max-w-full h-auto rounded shadow-sm" 
              />
            </div>
          ) : (
            <CodeViewer 
              content={currentArticle.content} 
              filename={articlePath.split('/').pop() || ''} 
            />
          )}

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
      {isEditing && !isReadOnly && isMarkdown && (
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
        title="Delete File"
        description={`Are you sure you want to delete "${currentArticle?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </MainLayout>
  )
}
