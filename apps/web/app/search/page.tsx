'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { api } from '@/lib/api'
import { useStore } from '@/lib/store'
import type { SearchResult } from '@/types/api'
import { Search as SearchIcon } from 'lucide-react'

function SearchContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ''

  const setError = useStore((state) => state.setError)

  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const performSearch = useCallback(async (searchQuery: string) => {
    try {
      setIsLoading(true)
      setHasSearched(true)
      const searchResults = await api.search(searchQuery)
      setResults(searchResults)
      setError(null)
    } catch (error: any) {
      setError(error.message || 'Failed to perform search')
      console.error('Search failed:', error)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [setError])

  useEffect(() => {
    if (query.trim()) {
      performSearch(query)
    }
  }, [query, performSearch])

  const highlightExcerpt = (excerpt: string) => {
    // The excerpt already contains HTML highlights from Whoosh
    return { __html: excerpt }
  }

  return (
    <MainLayout>
      <div className="wiki-main">
        <div className="wiki-content">
          <h1 className="wiki-page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <SearchIcon size={28} />
            Search Results
          </h1>

          {query && (
            <div style={{ marginBottom: '2rem' }}>
              <p style={{ color: '#54595d' }}>
                Searching for: <strong>"{query}"</strong>
              </p>
            </div>
          )}

          {!query && !hasSearched && (
            <div
              style={{
                padding: '2rem',
                backgroundColor: '#f8f9fa',
                border: '1px solid #a2a9b1',
                borderRadius: '2px',
                textAlign: 'center',
              }}
            >
              <SearchIcon size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <p style={{ margin: 0, color: '#54595d' }}>
                Enter a search query in the search bar above to find articles.
              </p>
            </div>
          )}

          {isLoading && (
            <div
              style={{
                padding: '2rem',
                textAlign: 'center',
              }}
            >
              <p style={{ color: '#54595d' }}>Searching...</p>
            </div>
          )}

          {!isLoading && hasSearched && results.length === 0 && query && (
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
                No articles found matching your search query.
              </p>
              <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#72777d' }}>
                Try different keywords or check your spelling.
              </p>
            </div>
          )}

          {!isLoading && results.length > 0 && (
            <div>
              <div style={{ marginBottom: '1.5rem', color: '#54595d', fontSize: '0.875rem' }}>
                Found {results.length} {results.length === 1 ? 'result' : 'results'}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {results.map((result) => (
                  <div
                    key={result.path}
                    style={{
                      padding: '1.5rem',
                      backgroundColor: '#f8f9fa',
                      border: '1px solid #a2a9b1',
                      borderRadius: '2px',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s, box-shadow 0.2s',
                    }}
                    onClick={() => router.push(`/article/${result.path}`)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#eaecf0'
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8f9fa'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    <h2
                      style={{
                        margin: '0 0 0.5rem 0',
                        fontSize: '1.5rem',
                        color: '#3366cc',
                      }}
                    >
                      {result.title}
                    </h2>

                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: '#72777d',
                        marginBottom: '0.75rem',
                      }}
                    >
                      <span style={{ fontFamily: 'monospace' }}>{result.path}</span>
                      {result.score !== undefined && (
                        <span style={{ marginLeft: '1rem' }}>
                          Relevance: {Math.round(result.score * 100)}%
                        </span>
                      )}
                    </div>

                    {result.snippet && (
                      <div
                        style={{
                          color: '#202122',
                          lineHeight: '1.6',
                        }}
                        dangerouslySetInnerHTML={highlightExcerpt(result.snippet)}
                      />
                    )}
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

export default function SearchPage() {
  return (
    <Suspense fallback={
      <MainLayout>
        <div className="wiki-main">
          <div className="wiki-content">
            <h1 className="wiki-page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <SearchIcon size={28} />
              Search Results
            </h1>
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <p style={{ color: '#54595d' }}>Loading search...</p>
            </div>
          </div>
        </div>
      </MainLayout>
    }>
      <SearchContent />
    </Suspense>
  )
}
