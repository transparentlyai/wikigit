'use client';

/**
 * New Folder page
 * Allows users to create a new directory/section in the wiki
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FolderPlus } from 'lucide-react';

export default function NewFolderPage() {
  const router = useRouter();
  const [folderPath, setFolderPath] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!folderPath.trim()) {
      alert('Please enter a folder path');
      return;
    }

    setIsCreating(true);

    try {
      // Create a .gitkeep file in the new directory to ensure it exists in git
      const response = await fetch('/api/articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: `${folderPath}/.gitkeep`,
          content: '',
          message: `Create directory ${folderPath}`,
        }),
      });

      if (response.ok) {
        alert('Folder created successfully!');
        router.push('/');
      } else {
        const error = await response.json();
        alert(`Error creating folder: ${error.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating folder:', error);
      alert('Failed to create folder');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <div style={{
      maxWidth: '600px',
      margin: '0 auto',
      padding: '48px 24px'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '24px'
      }}>
        <FolderPlus size={32} />
        <h1 style={{ margin: 0 }}>Create New Folder</h1>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label style={{
          display: 'block',
          fontWeight: 500,
          marginBottom: '8px'
        }}>
          Folder Path
        </label>
        <input
          type="text"
          value={folderPath}
          onChange={(e) => setFolderPath(e.target.value)}
          placeholder="e.g., docs or guides/tutorials"
          disabled={isCreating}
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid var(--color-border)',
            borderRadius: '4px',
            fontSize: '14px',
          }}
        />
        <p style={{
          fontSize: '12px',
          color: 'var(--color-text-secondary)',
          marginTop: '8px'
        }}>
          Use forward slashes (/) to create nested folders. Do not include a leading or trailing slash.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={handleCreate}
          className="btn btn-primary"
          disabled={isCreating || !folderPath.trim()}
        >
          {isCreating ? 'Creating...' : 'Create Folder'}
        </button>
        <button
          onClick={handleCancel}
          className="btn"
          disabled={isCreating}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
