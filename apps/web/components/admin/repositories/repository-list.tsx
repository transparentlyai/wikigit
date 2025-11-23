'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Database, RefreshCw } from 'lucide-react'
import { RepositoryCard } from './repository-card'
import { api } from '@/lib/api'
import type { RepositoryStatus } from '@/types/api'

export function RepositoryList() {
  const [repositories, setRepositories] = useState<RepositoryStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchRepositories()
  }, [])

  const fetchRepositories = async () => {
    try {
      setIsLoading(true)
      const data = await api.listRepositories()
      setRepositories(data.repositories)
    } catch (error: any) {
      toast.error(error.message || 'Failed to load repositories')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSync = async (id: string) => {
    await api.syncRepository(id)
    // Refresh the list to get updated status
    await fetchRepositories()
  }

  const handleDelete = async (id: string) => {
    await api.removeRepository(id)
    // Remove from local state
    setRepositories(repositories.filter((r) => r.id !== id))
  }

  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    await api.updateRepository(id, { enabled })
    // Update local state
    setRepositories(
      repositories.map((r) => (r.id === id ? { ...r, enabled } : r))
    )
    toast.success(`Repository ${enabled ? 'enabled' : 'disabled'}`)
  }

  const handleToggleReadOnly = async (id: string, readOnly: boolean) => {
    await api.updateRepository(id, { read_only: readOnly })
    // Update local state
    setRepositories(
      repositories.map((r) => (r.id === id ? { ...r, read_only: readOnly } : r))
    )
    toast.success(`Read-only mode ${readOnly ? 'enabled' : 'disabled'}`)
  }

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p style={{ color: '#54595d' }}>Loading repositories...</p>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 'bold' }}>
          Active Repositories
        </h3>
        <button
          onClick={fetchRepositories}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#eaecf0',
            color: '#202122',
            border: '1px solid #a2a9b1',
            borderRadius: '2px',
            cursor: 'pointer',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {repositories.length === 0 ? (
        <div
          style={{
            padding: '2rem',
            textAlign: 'center',
            backgroundColor: '#f8f9fa',
            border: '1px solid #a2a9b1',
            borderRadius: '2px',
          }}
        >
          <Database size={48} style={{ color: '#a2a9b1', margin: '0 auto 1rem' }} />
          <p style={{ color: '#54595d', margin: 0 }}>
            No repositories configured. Use the scanner above to add repositories.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {repositories.map((repo) => (
            <RepositoryCard
              key={repo.id}
              repository={repo}
              onSync={handleSync}
              onDelete={handleDelete}
              onToggleEnabled={handleToggleEnabled}
              onToggleReadOnly={handleToggleReadOnly}
            />
          ))}
        </div>
      )}
    </div>
  )
}
