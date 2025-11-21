'use client';

/**
 * New Article page
 * Allows users to create a new wiki article
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MarkdownEditor } from '@/components/editor';

export default function NewArticlePage() {
  const router = useRouter();
  const [path, setPath] = useState('');
  const [content, setContent] = useState('---\ntitle: New Article\nauthor: user@example.com\n---\n\n# New Article\n\nStart writing your article here...\n');

  const handleSave = async () => {
    if (!path.trim()) {
      alert('Please enter a path for the article');
      return;
    }

    try {
      const response = await fetch('/api/articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: path,
          content: content,
          message: `Create ${path}`,
        }),
      });

      if (response.ok) {
        // Navigate to the newly created article
        router.push(`/article/${encodeURIComponent(path)}`);
      } else {
        const error = await response.json();
        alert(`Error creating article: ${error.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating article:', error);
      alert('Failed to create article');
    }
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        padding: '16px',
        borderBottom: '1px solid var(--color-border-subtle)',
        display: 'flex',
        gap: '12px',
        alignItems: 'center'
      }}>
        <label style={{ fontWeight: 500 }}>
          Article Path:
        </label>
        <input
          type="text"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="e.g., Getting-Started.md or docs/API-Guide.md"
          style={{
            flex: 1,
            padding: '8px 12px',
            border: '1px solid var(--color-border)',
            borderRadius: '4px',
            fontSize: '14px',
          }}
        />
        <button onClick={handleSave} className="btn btn-primary">
          Create Article
        </button>
        <button onClick={handleCancel} className="btn">
          Cancel
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <MarkdownEditor
          content={content}
          onChange={setContent}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}
