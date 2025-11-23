'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { Search, Download, GitBranch, Lock, Globe } from 'lucide-react'
import { api } from '@/lib/api'
import { useWikiStore } from '@/lib/store'
import type { GitHubRepository } from '@/types/api'

export function RepositoryScanner() {
  const triggerRepositoryRefresh = useWikiStore((state) => state.triggerRepositoryRefresh)
  const [isScanning, setIsScanning] = useState(false)
  const [repositories, setRepositories] = useState<GitHubRepository[]>([])
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set())
  const [isCloning, setIsCloning] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const handleScan = async () => {
    try {
      setIsScanning(true)
      const data = await api.scanGitHubRepositories()
      setRepositories(data)
      toast.success(`Found ${data.length} repositories`)
    } catch (error: any) {
      toast.error(error.message || 'Failed to scan repositories')
    } finally {
      setIsScanning(false)
    }
  }

  const handleToggleRepo = (fullName: string) => {
    const newSelected = new Set(selectedRepos)
    if (newSelected.has(fullName)) {
      newSelected.delete(fullName)
    } else {
      newSelected.add(fullName)
    }
    setSelectedRepos(newSelected)
  }

  const handleToggleAll = () => {
    if (selectedRepos.size === filteredRepositories.length) {
      setSelectedRepos(new Set())
    } else {
      setSelectedRepos(new Set(filteredRepositories.map((r) => r.full_name)))
    }
  }

  const handleCloneSelected = async () => {
    if (selectedRepos.size === 0) {
      toast.error('No repositories selected')
      return
    }

    try {
      setIsCloning(true)
      const repoNames = Array.from(selectedRepos)
      await api.addRepositories(repoNames)
      toast.success(`Successfully cloned ${repoNames.length} repositories`)
      setSelectedRepos(new Set())
      setRepositories([])
      // Trigger sidebar refresh to show newly added repositories
      triggerRepositoryRefresh()
    } catch (error: any) {
      toast.error(error.message || 'Failed to clone repositories')
    } finally {
      setIsCloning(false)
    }
  }

  const filteredRepositories = repositories.filter((repo) =>
    repo.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (repo.description && repo.description.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div>
      <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.125rem' }}>
        Scan GitHub Repositories
      </h3>

      {/* Scan Button */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          onClick={handleScan}
          disabled={isScanning}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#3366cc',
            color: 'white',
            border: 'none',
            borderRadius: '2px',
            cursor: isScanning ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
            opacity: isScanning ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: 'bold',
          }}
        >
          <Search size={16} style={{ animation: isScanning ? 'spin 1s linear infinite' : 'none' }} />
          {isScanning ? 'Scanning GitHub...' : 'Scan GitHub Repositories'}
        </button>
      </div>

      {/* Results */}
      {repositories.length > 0 && (
        <div>
          {/* Search and Actions Bar */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              type="text"
              placeholder="Search repositories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                padding: '0.5rem',
                border: '1px solid #a2a9b1',
                borderRadius: '2px',
                fontSize: '0.875rem',
              }}
            />
            <button
              onClick={handleCloneSelected}
              disabled={isCloning || selectedRepos.size === 0}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#3366cc',
                color: 'white',
                border: 'none',
                borderRadius: '2px',
                cursor: isCloning || selectedRepos.size === 0 ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                opacity: isCloning || selectedRepos.size === 0 ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: 'bold',
                whiteSpace: 'nowrap',
              }}
            >
              <Download size={16} />
              {isCloning ? 'Cloning...' : `Clone Selected (${selectedRepos.size})`}
            </button>
          </div>

          {/* Repository List */}
          <div
            style={{
              border: '1px solid #a2a9b1',
              borderRadius: '2px',
              backgroundColor: 'white',
              maxHeight: '400px',
              overflowY: 'auto',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '0.75rem',
                borderBottom: '1px solid #a2a9b1',
                backgroundColor: '#f8f9fa',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                position: 'sticky',
                top: 0,
                zIndex: 1,
              }}
            >
              <input
                type="checkbox"
                checked={selectedRepos.size === filteredRepositories.length && filteredRepositories.length > 0}
                onChange={handleToggleAll}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.875rem', fontWeight: 'bold' }}>
                {filteredRepositories.length} repositories found
              </span>
            </div>

            {/* Repositories */}
            {filteredRepositories.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#54595d' }}>
                No repositories match your search.
              </div>
            ) : (
              filteredRepositories.map((repo) => (
                <label
                  key={repo.full_name}
                  style={{
                    display: 'flex',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    borderBottom: '1px solid #eaecf0',
                    cursor: 'pointer',
                    backgroundColor: selectedRepos.has(repo.full_name) ? '#f0f7ff' : 'white',
                  }}
                  onMouseEnter={(e) => {
                    if (!selectedRepos.has(repo.full_name)) {
                      e.currentTarget.style.backgroundColor = '#f8f9fa'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!selectedRepos.has(repo.full_name)) {
                      e.currentTarget.style.backgroundColor = 'white'
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedRepos.has(repo.full_name)}
                    onChange={() => handleToggleRepo(repo.full_name)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '0.875rem' }}>
                        {repo.full_name}
                      </span>
                      {repo.private ? (
                        <Lock size={14} style={{ color: '#54595d', flexShrink: 0 }} />
                      ) : (
                        <Globe size={14} style={{ color: '#54595d', flexShrink: 0 }} />
                      )}
                    </div>
                    {repo.description && (
                      <p style={{ margin: 0, fontSize: '0.8125rem', color: '#54595d', marginBottom: '0.25rem' }}>
                        {repo.description}
                      </p>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: '#72777d' }}>
                      <GitBranch size={12} />
                      default branch
                    </div>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
