'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { Folder, Plus, Trash2 } from 'lucide-react'

export function DirectoryManager() {
  const [newDirPath, setNewDirPath] = useState('')
  const [deleteDirPath, setDeleteDirPath] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleCreateDirectory = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newDirPath.trim()) {
      toast.error('Directory path is required')
      return
    }

    try {
      setIsCreating(true)
      await api.createDirectory(newDirPath.trim())
      toast.success(`Directory created: ${newDirPath}`)
      setNewDirPath('')
    } catch (error: any) {
      toast.error(error.message || 'Failed to create directory')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteDirectory = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!deleteDirPath.trim()) {
      toast.error('Directory path is required')
      return
    }

    if (!confirm(`Are you sure you want to delete the directory "${deleteDirPath}"? This will only work if the directory is empty.`)) {
      return
    }

    try {
      setIsDeleting(true)
      await api.deleteDirectory(deleteDirPath.trim())
      toast.success(`Directory deleted: ${deleteDirPath}`)
      setDeleteDirPath('')
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete directory')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Folder size={24} />
        Directory Management
      </h2>

      {/* Create Directory Section */}
      <div
        style={{
          padding: '1.5rem',
          backgroundColor: '#f8f9fa',
          border: '1px solid #a2a9b1',
          borderRadius: '2px',
          marginBottom: '2rem',
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={20} />
          Create Directory
        </h3>
        <form onSubmit={handleCreateDirectory}>
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="new-dir-path"
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 'bold',
                fontSize: '0.875rem',
              }}
            >
              Directory Path
            </label>
            <input
              id="new-dir-path"
              type="text"
              value={newDirPath}
              onChange={(e) => setNewDirPath(e.target.value)}
              placeholder="docs/tutorials"
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
              Use forward slashes for nested directories (e.g., "guides/getting-started")
            </small>
          </div>
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
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Plus size={16} />
            {isCreating ? 'Creating...' : 'Create Directory'}
          </button>
        </form>
      </div>

      {/* Delete Directory Section */}
      <div
        style={{
          padding: '1.5rem',
          backgroundColor: '#f8f9fa',
          border: '1px solid #a2a9b1',
          borderRadius: '2px',
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Trash2 size={20} />
          Delete Directory
        </h3>
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#fef0e8',
            border: '1px solid #f4c7a8',
            borderRadius: '2px',
            marginBottom: '1rem',
          }}
        >
          <strong style={{ color: '#d33' }}>Warning:</strong> Directories can only be deleted if they are empty (no articles inside).
          Delete all articles first before removing a directory.
        </div>
        <form onSubmit={handleDeleteDirectory}>
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="delete-dir-path"
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 'bold',
                fontSize: '0.875rem',
              }}
            >
              Directory Path
            </label>
            <input
              id="delete-dir-path"
              type="text"
              value={deleteDirPath}
              onChange={(e) => setDeleteDirPath(e.target.value)}
              placeholder="docs/tutorials"
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
          <button
            type="submit"
            disabled={isDeleting}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#d33',
              color: 'white',
              border: 'none',
              borderRadius: '2px',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              opacity: isDeleting ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Trash2 size={16} />
            {isDeleting ? 'Deleting...' : 'Delete Directory'}
          </button>
        </form>
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
        <h4 style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: '1rem' }}>About Directories</h4>
        <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#54595d' }}>
          <li>Directories help organize articles into hierarchical sections</li>
          <li>Parent directories are automatically created if they don't exist</li>
          <li>Empty directories contain a .gitkeep file to track them in git</li>
          <li>Directories with articles cannot be deleted - remove articles first</li>
          <li>The sidebar navigation reflects the directory structure</li>
        </ul>
      </div>
    </div>
  )
}
