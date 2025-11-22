'use client';

/**
 * New Article page
 * Allows users to create a new wiki article
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { MainLayout } from '@/components/layout/main-layout';
import { MarkdownEditor } from '@/components/editor/markdown-editor';

export default function NewArticlePage() {
  const router = useRouter();
  const [path, setPath] = useState('');
  const [content, setContent] = useState('---\ntitle: New Article\nauthor: user@example.com\n---\n\n# New Article\n\nStart writing your article here...\n');

  const handleSave = async () => {
    if (!path.trim()) {
      toast.error('Please enter a path for the article');
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
        toast.success('Article created successfully');
        // Navigate to the newly created article
        router.push(`/article/${encodeURIComponent(path)}`);
      } else {
        const error = await response.json();
        toast.error(`Error creating article: ${error.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating article:', error);
      toast.error('Failed to create article');
    }
  };

  return (
    <MainLayout breadcrumbs={[{ label: 'New Article' }]}>
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Article Path
        </label>
        <input
          type="text"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="e.g., Getting-Started.md or docs/API-Guide.md"
          className="w-full bg-white border border-gray-200 rounded-md py-1.5 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
        />
      </div>

      <div className="absolute inset-x-0 bottom-0 top-32 bg-white z-40 flex flex-col">
        <MarkdownEditor
          value={content}
          onChange={setContent}
          onSave={handleSave}
        />
      </div>
    </MainLayout>
  );
}
