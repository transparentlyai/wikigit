'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { RefreshCw, Trash2, GitBranch } from 'lucide-react'
import { SyncStatusBadge } from './sync-status-badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import type { RepositoryStatus } from '@/types/api'

interface RepositoryCardProps {
  repository: RepositoryStatus
  onSync: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onToggleEnabled: (id: string, enabled: boolean) => Promise<void>
  onToggleReadOnly: (id: string, readOnly: boolean) => Promise<void>
}

export function RepositoryCard({
  repository,
  onSync,
  onDelete,
  onToggleEnabled,
  onToggleReadOnly,
}: RepositoryCardProps) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleSync = async () => {
    try {
      setIsSyncing(true)
      await onSync(repository.id)
      toast.success(`Synced ${repository.owner}/${repository.name} successfully`)
    } catch (error: any) {
      toast.error(error.message || `Failed to sync ${repository.owner}/${repository.name}`)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleDelete = async () => {
    try {
      await onDelete(repository.id)
      toast.success(`Removed ${repository.owner}/${repository.name}`)
      setShowDeleteConfirm(false)
    } catch (error: any) {
      toast.error(error.message || `Failed to remove ${repository.owner}/${repository.name}`)
    }
  }

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Never'
    const date = new Date(dateStr)
    return date.toLocaleString()
  }

  const getStatusTooltip = () => {
    if (repository.error_message) {
      return `Error: ${repository.error_message}`
    }
    if (repository.last_synced) {
      return `Last synced: ${formatDate(repository.last_synced)}`
    }
    return undefined
  }

  return (
    <>
      <div
        style={{
          padding: '1.5rem',
          backgroundColor: '#f8f9fa',
          border: '1px solid #a2a9b1',
          borderRadius: '2px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 'bold' }}>
              {repository.owner}/{repository.name}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
              <span style={{ fontSize: '0.875rem', color: '#54595d', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <GitBranch size={14} />
                {repository.default_branch}
              </span>
            </div>
          </div>
          <SyncStatusBadge status={repository.sync_status} tooltip={getStatusTooltip()} />
        </div>

        {/* Last Synced */}
        <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#54595d' }}>
          <strong>Last synced:</strong> {formatDate(repository.last_synced)}
        </div>

        {/* Error Message */}
        {repository.error_message && (
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.5rem',
              backgroundColor: '#fee7e6',
              border: '1px solid #d33',
              borderRadius: '2px',
              fontSize: '0.875rem',
              color: '#d33',
            }}
          >
            {repository.error_message}
          </div>
        )}

        {/* Toggles */}
        <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={repository.enabled}
              onChange={(e) => onToggleEnabled(repository.id, e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.875rem' }}>Enabled</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={repository.read_only}
              onChange={(e) => onToggleReadOnly(repository.id, e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.875rem' }}>Read-only</span>
          </label>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleSync}
            disabled={isSyncing || !repository.enabled}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#3366cc',
              color: 'white',
              border: 'none',
              borderRadius: '2px',
              cursor: isSyncing || !repository.enabled ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              opacity: isSyncing || !repository.enabled ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: 'bold',
            }}
          >
            <RefreshCw size={14} style={{ animation: isSyncing ? 'spin 1s linear infinite' : 'none' }} />
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>

          <button
            onClick={() => setShowDeleteConfirm(true)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#d33',
              color: 'white',
              border: 'none',
              borderRadius: '2px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: 'bold',
            }}
          >
            <Trash2 size={14} />
            Remove
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Remove Repository"
        description={`Are you sure you want to remove ${repository.owner}/${repository.name}? This will remove the repository configuration but will not delete any files.`}
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={handleDelete}
        variant="destructive"
      />

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  )
}
