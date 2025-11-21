'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { useStore } from '@/lib/store'
import { api } from '@/lib/api'
import { Plus } from 'lucide-react'
import type { ArticleSummary } from '@/types/api'

export default function HomePage() {
  const router = useRouter()
  const articles = useStore((state) => state.articles)
  const setArticles = useStore((state) => state.setArticles)
  const setError = useStore((state) => state.setError)

  const [isLoading, setIsLoading] = useState(true)
  const [newArticlePath, setNewArticlePath] = useState('')
  const [newArticleTitle, setNewArticleTitle] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)

  // Fetch articles on mount
  useEffect(() => {
    const fetchArticles = async () => {
      try {
        setIsLoading(true)
        const response = await api.getArticles()
        setArticles(response.articles)
      } catch (error: any) {
        setError(error.message || 'Failed to load articles')
        console.error('Failed to fetch articles:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchArticles()
  }, [setArticles, setError])

  const handleCreateArticle = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newArticlePath.trim() || !newArticleTitle.trim()) {
      setError('Path and title are required')
      return
    }

    try {
      setIsCreating(true)
      const article = await api.createArticle({
        path: newArticlePath.trim(),
        title: newArticleTitle.trim(),
        content: `# ${newArticleTitle}\n\nStart writing your article here...`,
      })

      // Refresh articles list
      const response = await api.getArticles()
      setArticles(response.articles)

      // Navigate to the new article
      router.push(`/article/${article.path}`)
    } catch (error: any) {
      setError(error.message || 'Failed to create article')
      console.error('Failed to create article:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleCancelCreate = () => {
    setShowCreateForm(false)
    setNewArticlePath('')
    setNewArticleTitle('')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <MainLayout>
      <div className="wiki-main">
        <div className="wiki-content">
          <h1 className="wiki-page-title">Welcome to WikiGit</h1>

          {/* Create Article Button */}
          <div style={{ marginBottom: '2rem' }}>
            {!showCreateForm && (
              <button
                onClick={() => setShowCreateForm(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#3366cc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                }}
              >
                <Plus size={20} />
                Create New Article
              </button>
            )}

            {/* Create Article Form */}
            {showCreateForm && (
              <div
                style={{
                  padding: '1.5rem',
                  backgroundColor: '#f8f9fa',
                  border: '1px solid #a2a9b1',
                  borderRadius: '2px',
                  marginTop: '1rem',
                }}
              >
                <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.25rem' }}>
                  Create New Article
                </h2>
                <form onSubmit={handleCreateArticle}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label
                      htmlFor="article-path"
                      style={{
                        display: 'block',
                        marginBottom: '0.5rem',
                        fontWeight: 'bold',
                        fontSize: '0.875rem',
                      }}
                    >
                      Article Path (e.g., "docs/getting-started" or "readme")
                    </label>
                    <input
                      id="article-path"
                      type="text"
                      value={newArticlePath}
                      onChange={(e) => setNewArticlePath(e.target.value)}
                      placeholder="docs/my-article"
                      required
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #a2a9b1',
                        borderRadius: '2px',
                        fontSize: '1rem',
                      }}
                    />
                    <small style={{ display: 'block', marginTop: '0.25rem', color: '#54595d' }}>
                      Use forward slashes for subdirectories. Do not include .md extension.
                    </small>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label
                      htmlFor="article-title"
                      style={{
                        display: 'block',
                        marginBottom: '0.5rem',
                        fontWeight: 'bold',
                        fontSize: '0.875rem',
                      }}
                    >
                      Article Title
                    </label>
                    <input
                      id="article-title"
                      type="text"
                      value={newArticleTitle}
                      onChange={(e) => setNewArticleTitle(e.target.value)}
                      placeholder="My Article Title"
                      required
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #a2a9b1',
                        borderRadius: '2px',
                        fontSize: '1rem',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="submit"
                      disabled={isCreating}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#3366cc',
                        color: 'white',
                        border: 'none',
                        borderRadius: '2px',
                        cursor: isCreating ? 'not-allowed' : 'pointer',
                        fontSize: '0.875rem',
                        opacity: isCreating ? 0.6 : 1,
                      }}
                    >
                      {isCreating ? 'Creating...' : 'Create Article'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelCreate}
                      disabled={isCreating}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#eaecf0',
                        color: '#202122',
                        border: '1px solid #a2a9b1',
                        borderRadius: '2px',
                        cursor: isCreating ? 'not-allowed' : 'pointer',
                        fontSize: '0.875rem',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Articles List */}
          {isLoading && <p>Loading articles...</p>}

          {!isLoading && articles.length === 0 && (
            <div
              style={{
                padding: '2rem',
                backgroundColor: '#f8f9fa',
                border: '1px solid #a2a9b1',
                borderRadius: '2px',
                textAlign: 'center',
              }}
            >
              <p style={{ margin: 0, color: '#54595d' }}>
                No articles yet. Create your first article to get started!
              </p>
            </div>
          )}

          {!isLoading && articles.length > 0 && (
            <div>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>All Articles</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {articles.map((article: ArticleSummary) => (
                  <div
                    key={article.path}
                    style={{
                      padding: '1rem',
                      backgroundColor: '#f8f9fa',
                      border: '1px solid #a2a9b1',
                      borderRadius: '2px',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                    onClick={() => router.push(`/article/${article.path}`)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#eaecf0'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8f9fa'
                    }}
                  >
                    <h3
                      style={{
                        margin: '0 0 0.5rem 0',
                        fontSize: '1.25rem',
                        color: '#3366cc',
                      }}
                    >
                      {article.title}
                    </h3>
                    <div style={{ fontSize: '0.875rem', color: '#54595d' }}>
                      <div>
                        <strong>Path:</strong> {article.path}
                      </div>
                      <div>
                        <strong>Author:</strong> {article.author}
                      </div>
                      <div>
                        <strong>Last updated:</strong> {formatDate(article.updated_at)} by{' '}
                        {article.updated_by}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  )
}
