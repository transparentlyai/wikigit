'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { MainLayout } from '@/components/layout/main-layout'
import { api } from '@/lib/api'
import type { SearchResult } from '@/types/api'
import { Search as SearchIcon, FileText, ChevronRight } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function SearchContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ''

  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [inputValue, setInputValue] = useState(query)

  const performSearch = useCallback(async (searchQuery: string) => {
    try {
      setIsLoading(true)
      setHasSearched(true)
      const searchResults = await api.search(searchQuery)
      setResults(searchResults)
    } catch (error: any) {
      toast.error(error.message || 'Failed to perform search')
      console.error('Search failed:', error)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    setInputValue(query)
  }, [query])

  useEffect(() => {
    if (query.trim()) {
      performSearch(query)
    }
  }, [query, performSearch])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue !== query) {
        const params = new URLSearchParams(searchParams.toString())
        if (inputValue.trim()) {
          params.set('q', inputValue)
        } else {
          params.delete('q')
        }
        router.push(`/search?${params.toString()}`)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [inputValue, query, searchParams, router])

  const stripHtmlTags = (html: string) => {
    // Strip HTML highlight tags from Whoosh but keep the text content
    return html.replace(/<[^>]*>/g, '')
  }

  const stripImages = (markdown: string) => {
    // Remove markdown images: ![alt](url)
    let cleaned = markdown.replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    // Remove HTML img tags
    cleaned = cleaned.replace(/<img[^>]*>/gi, '')
    return cleaned
  }

  return (
    <MainLayout>
      <style jsx>{`
        .search-preview :global(*) {
          font-size: inherit;
          line-height: inherit;
        }
        .search-preview :global(h1),
        .search-preview :global(h2),
        .search-preview :global(h3),
        .search-preview :global(h4),
        .search-preview :global(h5),
        .search-preview :global(h6) {
          font-weight: 600;
          margin: 0;
          display: inline;
        }
        .search-preview :global(p) {
          margin: 0;
          display: inline;
        }
        .search-preview :global(ul),
        .search-preview :global(ol) {
          margin: 0;
          padding-left: 1.2em;
          display: inline;
        }
        .search-preview :global(li) {
          display: inline;
        }
        .search-preview :global(code) {
          font-size: 0.9em;
          font-family: monospace;
          background: #f4f4f4;
          padding: 0.1em 0.3em;
          border-radius: 2px;
        }
        .search-preview :global(pre) {
          display: inline;
          background: #f4f4f4;
          padding: 0.2em 0.4em;
          border-radius: 2px;
        }
      `}</style>
      <div className="flex-1 flex flex-col min-w-0 bg-white -mt-8">
        {/* Sticky Search Header */}
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 pt-4 pb-4 px-6">
          <div className="max-w-3xl mx-auto">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <SearchIcon className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              </div>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="block w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all shadow-sm text-base"
                placeholder="Search documentation..."
              />
            </div>

            {query && hasSearched && (
              <div className="mt-3 flex items-center justify-between text-sm">
                <p className="text-gray-500">
                  {isLoading ? (
                    'Searching...'
                  ) : (
                    <>
                      Found{' '}
                      <span className="font-medium text-gray-900">
                        {results.length} {results.length === 1 ? 'result' : 'results'}
                      </span>{' '}
                      for{' '}
                      <span className="font-medium text-gray-900">"{query}"</span>
                    </>
                  )}
                </p>
              </div>
            )}
            <p className="text-gray-500 text-sm mt-2">
              Search indexes Markdown content and filenames of other files.
            </p>
          </div>
        </div>

        {/* Results Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-12">
          <div className="max-w-3xl mx-auto mt-6">
            {!query && !hasSearched && (
              <div className="text-center py-12">
                <SearchIcon className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <p className="text-gray-500">
                  Enter a search query above to find articles.
                </p>
              </div>
            )}

            {!isLoading && hasSearched && results.length === 0 && query && (
              <div className="text-center py-12">
                <SearchIcon className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <p className="text-gray-900 font-medium mb-1">
                  No articles found
                </p>
                <p className="text-sm text-gray-500">
                  Try different keywords or check your spelling.
                </p>
              </div>
            )}

            {!isLoading && results.length > 0 && (
              <ul className="divide-y divide-gray-100">
                {results.map((result, index) => {
                  const pathParts = result.path.split('/');
                  const relevance = Math.round(result.score * 100);
                  const articleUrl = result.repository_id ? `/${result.repository_id}/${result.path}` : `/${result.path}`;

                  return (
                    <li
                      key={`${result.path}:${index}`}
                      className="group py-5 first:pt-2 hover:bg-gray-50/50 -mx-4 px-4 rounded-xl transition-colors cursor-pointer"
                      onClick={() => router.push(articleUrl)}
                    >
                      <div className="flex items-start gap-4">
                        {/* Icon Column */}
                        <div className="mt-1.5 flex-shrink-0 p-2 bg-gray-50 rounded-lg border border-gray-100 group-hover:bg-white group-hover:shadow-sm transition-all">
                          <FileText className="w-5 h-5 text-gray-400" />
                        </div>

                        {/* Content Column */}
                        <div className="flex-1 min-w-0">
                          {/* Meta / Breadcrumbs */}
                          <div className="flex items-center text-xs text-gray-500 mb-1 space-x-1">
                            {pathParts.map((crumb, idx) => (
                              <span key={idx} className="flex items-center space-x-1">
                                <span className="uppercase tracking-wide font-medium">
                                  {crumb}
                                </span>
                                {idx < pathParts.length - 1 && (
                                  <ChevronRight className="w-3 h-3 text-gray-300" />
                                )}
                              </span>
                            ))}
                          </div>

                          {/* Title */}
                          <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors leading-snug mb-1">
                            {result.title}
                          </h3>

                          {/* Snippet */}
                          {result.snippet && (
                            <div className="text-sm text-gray-600 leading-relaxed line-clamp-2 search-preview">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {stripImages(stripHtmlTags(result.snippet))}
                              </ReactMarkdown>
                            </div>
                          )}
                        </div>

                        {/* Relevance Badge */}
                        <div className="flex-shrink-0 pl-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              relevance >= 90
                                ? 'bg-green-100 text-green-800'
                                : relevance >= 70
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {relevance}%
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
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
