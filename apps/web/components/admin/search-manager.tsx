'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { Search, RefreshCw } from 'lucide-react'

export function SearchManager() {
  const [isReindexing, setIsReindexing] = useState(false)

  const handleReindex = async () => {
    if (!confirm('Rebuild the entire search index? This may take a few minutes for large wikis.')) {
      return
    }

    try {
      setIsReindexing(true)
      const result = await api.reindexSearch()
      toast.success(`Search index rebuilt successfully. Indexed ${result.document_count} articles.`)
    } catch (error: any) {
      toast.error(error.message || 'Failed to rebuild search index')
    } finally {
      setIsReindexing(false)
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Search size={24} />
        Search Index Management
      </h2>

      {/* Reindex Section */}
      <div
        style={{
          padding: '1.5rem',
          backgroundColor: '#f8f9fa',
          border: '1px solid #a2a9b1',
          borderRadius: '2px',
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.125rem' }}>
          Rebuild Search Index
        </h3>
        <p style={{ marginBottom: '1rem', color: '#54595d', lineHeight: '1.6' }}>
          The search index is automatically updated when articles are created, updated, or deleted.
          Use this tool if you need to rebuild the entire index from scratch (e.g., after manual
          file changes or index corruption).
        </p>
        <button
          onClick={handleReindex}
          disabled={isReindexing}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#3366cc',
            color: 'white',
            border: 'none',
            borderRadius: '2px',
            cursor: isReindexing ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
            opacity: isReindexing ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: 'bold',
          }}
        >
          <RefreshCw size={16} style={{ animation: isReindexing ? 'spin 1s linear infinite' : 'none' }} />
          {isReindexing ? 'Rebuilding Index...' : 'Rebuild Search Index'}
        </button>
      </div>

      {/* Information Section */}
      <div
        style={{
          marginTop: '2rem',
          padding: '1rem',
          backgroundColor: '#f0f7ff',
          border: '1px solid #a8d4ff',
          borderRadius: '2px',
        }}
      >
        <h4 style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: '1rem' }}>About Search</h4>
        <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#54595d', lineHeight: '1.6' }}>
          <li>Search indexes article titles and content for full-text search</li>
          <li>Title matches are boosted for higher relevance</li>
          <li>Index is automatically updated when articles are modified</li>
          <li>Manual reindex is only needed for troubleshooting or after direct file changes</li>
          <li>Reindexing is safe and can be performed at any time</li>
        </ul>
      </div>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
