'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Settings, Save, TestTube2 } from 'lucide-react'
import { api } from '@/lib/api'

export function GitHubSettings() {
  const [githubUserId, setGithubUserId] = useState('')
  const [githubTokenVar, setGithubTokenVar] = useState('GITHUB_TOKEN')
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Load existing settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await api.getGitHubSettings()
        setGithubUserId(settings.user_id || '')
        setGithubTokenVar(settings.token_env_var || 'GITHUB_TOKEN')
        setIsLoading(false)
      } catch (error) {
        console.error('Failed to load GitHub settings:', error)
        setIsLoading(false)
      }
    }
    loadSettings()
  }, [])

  const handleTestConnection = async () => {
    if (!githubUserId) {
      toast.error('Please enter a GitHub user ID')
      return
    }

    try {
      setIsTesting(true)
      await api.testGitHubConnection({ user_id: githubUserId, token_var: githubTokenVar })
      toast.success('GitHub connection successful!')
    } catch (error: any) {
      toast.error(error.message || 'Failed to connect to GitHub')
    } finally {
      setIsTesting(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!githubUserId) {
      toast.error('Please enter a GitHub user ID')
      return
    }

    try {
      setIsSaving(true)
      await api.saveGitHubSettings({
        user_id: githubUserId,
        token_var: githubTokenVar,
      })
      toast.success('GitHub settings saved successfully')
    } catch (error: any) {
      toast.error(error.message || 'Failed to save GitHub settings')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div>
      <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Settings size={20} />
        GitHub Configuration
      </h3>

      <form onSubmit={handleSave}>
        <div
          style={{
            padding: '1.5rem',
            backgroundColor: '#f8f9fa',
            border: '1px solid #a2a9b1',
            borderRadius: '2px',
            marginBottom: '1.5rem',
          }}
        >
          {/* GitHub User ID */}
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="github-user-id"
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 'bold',
                fontSize: '0.875rem',
              }}
            >
              GitHub User ID
            </label>
            <input
              id="github-user-id"
              type="text"
              value={githubUserId}
              onChange={(e) => setGithubUserId(e.target.value)}
              placeholder="your-github-username"
              required
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #a2a9b1',
                borderRadius: '2px',
                fontSize: '1rem',
                fontFamily: 'monospace',
              }}
            />
            <small style={{ display: 'block', marginTop: '0.25rem', color: '#54595d' }}>
              Your GitHub username or organization name to scan repositories from.
            </small>
          </div>

          {/* GitHub Token Environment Variable */}
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="github-token-var"
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 'bold',
                fontSize: '0.875rem',
              }}
            >
              GitHub Token Environment Variable
            </label>
            <input
              id="github-token-var"
              type="text"
              value={githubTokenVar}
              onChange={(e) => setGithubTokenVar(e.target.value)}
              placeholder="GITHUB_TOKEN"
              required
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #a2a9b1',
                borderRadius: '2px',
                fontSize: '1rem',
                fontFamily: 'monospace',
              }}
            />
            <small style={{ display: 'block', marginTop: '0.25rem', color: '#54595d' }}>
              Name of the environment variable containing your GitHub personal access token.
            </small>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#eaecf0',
                color: '#202122',
                border: '1px solid #a2a9b1',
                borderRadius: '2px',
                cursor: isTesting ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                opacity: isTesting ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <TestTube2 size={16} />
              {isTesting ? 'Testing...' : 'Test Connection'}
            </button>

            <button
              type="submit"
              disabled={isSaving}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#3366cc',
                color: 'white',
                border: 'none',
                borderRadius: '2px',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                opacity: isSaving ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: 'bold',
              }}
            >
              <Save size={16} />
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </form>

      {/* Information Box */}
      <div
        style={{
          padding: '1rem',
          backgroundColor: '#f0f7ff',
          border: '1px solid #a8d4ff',
          borderRadius: '2px',
        }}
      >
        <h4 style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: '1rem' }}>Setup Instructions</h4>
        <ol style={{ margin: 0, paddingLeft: '1.5rem', color: '#54595d', lineHeight: '1.6' }}>
          <li>
            Create a GitHub Personal Access Token with <code style={{ backgroundColor: '#fff', padding: '2px 4px' }}>repo</code> scope
          </li>
          <li>
            Set the token as an environment variable (e.g., <code style={{ backgroundColor: '#fff', padding: '2px 4px' }}>export GITHUB_TOKEN=ghp_...</code>)
          </li>
          <li>Enter your GitHub username or organization name above</li>
          <li>Test the connection to verify your credentials</li>
          <li>Save the settings to enable repository scanning</li>
        </ol>
      </div>
    </div>
  )
}
