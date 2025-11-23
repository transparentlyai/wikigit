'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { Home } from 'lucide-react';
import type { ConfigData, RepositoryStatus, Article } from '@/types/api';

interface HomePageSelectorProps {
  config: ConfigData;
  onSave: () => void;
}

export function HomePageSelector({ config, onSave }: HomePageSelectorProps) {
  const [repositories, setRepositories] = useState<RepositoryStatus[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedRepo, setSelectedRepo] = useState(config.home_page_repository || '');
  const [selectedArticle, setSelectedArticle] = useState(config.home_page_article || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingArticles, setIsLoadingArticles] = useState(false);

  useEffect(() => {
    const fetchRepositories = async () => {
      try {
        const response = await api.listRepositories();
        setRepositories(response.repositories.filter(r => r.enabled));
      } catch (error) {
        console.error('Failed to fetch repositories:', error);
      }
    };
    fetchRepositories();
  }, []);

  useEffect(() => {
    if (selectedRepo) {
      const fetchArticles = async () => {
        setIsLoadingArticles(true);
        try {
          const response = await api.getArticles(selectedRepo);
          setArticles(response.articles);
        } catch (error) {
          console.error('Failed to fetch articles:', error);
        } finally {
          setIsLoadingArticles(false);
        }
      };
      fetchArticles();
    } else {
      setArticles([]);
    }
  }, [selectedRepo]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await api.updateConfig({
        app: {
          home_page_repository: selectedRepo || null,
          home_page_article: selectedArticle || null,
        },
      });
      toast.success('Home page configuration saved');
      onSave();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save home page configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    try {
      setIsSaving(true);
      await api.updateConfig({
        app: {
          home_page_repository: null,
          home_page_article: null,
        },
      });
      setSelectedRepo('');
      setSelectedArticle('');
      toast.success('Home page cleared');
      onSave();
    } catch (error: any) {
      toast.error(error.message || 'Failed to clear home page');
    } finally {
      setIsSaving(false);
    }
  };

  return (
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
        <Home size={20} />
        Home Page Configuration
      </h3>

      <div style={{ marginBottom: '1rem' }}>
        <label
          htmlFor="home-repo"
          style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: 'bold',
            fontSize: '0.875rem',
          }}
        >
          Repository
        </label>
        <select
          id="home-repo"
          value={selectedRepo}
          onChange={(e) => {
            setSelectedRepo(e.target.value);
            setSelectedArticle('');
          }}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid #a2a9b1',
            borderRadius: '2px',
            fontSize: '1rem',
          }}
        >
          <option value="">Select a repository...</option>
          {repositories.map((repo) => (
            <option key={repo.id} value={repo.id}>
              {repo.name}
            </option>
          ))}
        </select>
      </div>

      {selectedRepo && (
        <div style={{ marginBottom: '1rem' }}>
          <label
            htmlFor="home-article"
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 'bold',
              fontSize: '0.875rem',
            }}
          >
            Article
          </label>
          <select
            id="home-article"
            value={selectedArticle}
            onChange={(e) => setSelectedArticle(e.target.value)}
            disabled={isLoadingArticles || articles.length === 0}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #a2a9b1',
              borderRadius: '2px',
              fontSize: '1rem',
            }}
          >
            <option value="">Select an article...</option>
            {articles.map((article) => (
              <option key={article.path} value={article.path}>
                {article.title}
              </option>
            ))}
          </select>
          {isLoadingArticles && (
            <small style={{ display: 'block', marginTop: '0.25rem', color: '#54595d' }}>
              Loading articles...
            </small>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={handleSave}
          disabled={isSaving || !selectedRepo || !selectedArticle}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#3366cc',
            color: 'white',
            border: 'none',
            borderRadius: '2px',
            cursor: isSaving || !selectedRepo || !selectedArticle ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
            opacity: isSaving || !selectedRepo || !selectedArticle ? 0.6 : 1,
          }}
        >
          {isSaving ? 'Saving...' : 'Save Home Page'}
        </button>
        {config.home_page_repository && (
          <button
            onClick={handleClear}
            disabled={isSaving}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#eaecf0',
              color: '#202122',
              border: '1px solid #a2a9b1',
              borderRadius: '2px',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Clear Home Page
          </button>
        )}
      </div>

      <small style={{ display: 'block', marginTop: '1rem', color: '#54595d' }}>
        The home page will be displayed when users visit the root URL. If not configured, a welcome page will be shown instead.
      </small>
    </div>
  );
}
