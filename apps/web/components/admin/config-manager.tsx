'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Settings, Save, RefreshCw } from 'lucide-react'
import type { ConfigData } from '@/types/api'

export function ConfigManager() {
  const [config, setConfig] = useState<ConfigData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [appName, setAppName] = useState('')
  const [admins, setAdmins] = useState('')
  const [autoPush, setAutoPush] = useState(false)
  const [remoteUrl, setRemoteUrl] = useState('')
  const [remoteToken, setRemoteToken] = useState('')

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      setIsLoading(true)
      const configData = await api.getConfig()
      setConfig(configData)

      // Populate form fields
      setAppName(configData.app_name)
      setAdmins(configData.admins.join('\n'))
      setAutoPush(configData.auto_push)
      setRemoteUrl(configData.remote_url || '')
      setRemoteToken(configData.github_token || '')
    } catch (error: any) {
      setError(error.message || 'Failed to load configuration')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    try {
      setIsSaving(true)

      // Parse admins from textarea (one per line)
      const adminsList = admins
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)

      const updatedConfig = await api.updateConfig({
        app: {
          name: appName,
          admins: adminsList,
        },
        repository: {
          auto_push: autoPush,
          remote_url: remoteUrl || undefined,
          github_token: remoteToken || undefined,
        },
      })

      setConfig(updatedConfig)
      setSuccess('Configuration saved successfully. Restart the application to apply changes.')
    } catch (error: any) {
      setError(error.message || 'Failed to save configuration')
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    if (config) {
      setAppName(config.app_name)
      setAdmins(config.admins.join('\n'))
      setAutoPush(config.auto_push)
      setRemoteUrl(config.remote_url || '')
      setRemoteToken(config.github_token || '')
      setError(null)
      setSuccess(null)
    }
  }

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p style={{ color: '#54595d' }}>Loading configuration...</p>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Settings size={24} />
        Configuration Settings
      </h2>

      {/* Error/Success Messages */}
      {error && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#fee',
            border: '1px solid #fcc',
            borderRadius: '2px',
            marginBottom: '1rem',
            color: '#c33',
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#efe',
            border: '1px solid #cfc',
            borderRadius: '2px',
            marginBottom: '1rem',
            color: '#3c3',
          }}
        >
          {success}
        </div>
      )}

      {/* Configuration Form */}
      <form onSubmit={handleSave}>
        <div
          style={{
            padding: '1.5rem',
            backgroundColor: '#f8f9fa',
            border: '1px solid #a2a9b1',
            borderRadius: '2px',
            marginBottom: '2rem',
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.125rem' }}>
            Application Settings
          </h3>

          {/* App Name */}
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="app-name"
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 'bold',
                fontSize: '0.875rem',
              }}
            >
              Application Name
            </label>
            <input
              id="app-name"
              type="text"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
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

          {/* Admins */}
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="admins"
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 'bold',
                fontSize: '0.875rem',
              }}
            >
              Admin Users (one email per line)
            </label>
            <textarea
              id="admins"
              value={admins}
              onChange={(e) => setAdmins(e.target.value)}
              required
              rows={5}
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
              Admin users have access to this admin panel and can delete directories.
            </small>
          </div>
        </div>

        {/* Repository Settings */}
        <div
          style={{
            padding: '1.5rem',
            backgroundColor: '#f8f9fa',
            border: '1px solid #a2a9b1',
            borderRadius: '2px',
            marginBottom: '2rem',
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.125rem' }}>
            Repository Settings
          </h3>

          {/* Read-only fields */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.875rem' }}>
              Repository Path (read-only)
            </label>
            <input
              type="text"
              value={config?.repo_path || ''}
              disabled
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #a2a9b1',
                borderRadius: '2px',
                fontSize: '1rem',
                backgroundColor: '#eaecf0',
                color: '#54595d',
              }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.875rem' }}>
              Default Branch (read-only)
            </label>
            <input
              type="text"
              value={config?.default_branch || ''}
              disabled
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #a2a9b1',
                borderRadius: '2px',
                fontSize: '1rem',
                backgroundColor: '#eaecf0',
                color: '#54595d',
              }}
            />
          </div>

          {/* Auto Push */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={autoPush}
                onChange={(e) => setAutoPush(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span style={{ fontWeight: 'bold', fontSize: '0.875rem' }}>
                Automatically push changes to remote repository
              </span>
            </label>
            <small style={{ display: 'block', marginTop: '0.25rem', marginLeft: '26px', color: '#54595d' }}>
              When enabled, all commits will be automatically pushed to the remote repository.
            </small>
          </div>

          {/* Remote URL */}
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="remote-url"
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 'bold',
                fontSize: '0.875rem',
              }}
            >
              Remote Repository URL (optional)
            </label>
            <input
              id="remote-url"
              type="text"
              value={remoteUrl}
              onChange={(e) => setRemoteUrl(e.target.value)}
              placeholder="https://github.com/username/repo.git"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #a2a9b1',
                borderRadius: '2px',
                fontSize: '1rem',
                fontFamily: 'monospace',
              }}
            />
          </div>

          {/* Remote Token */}
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="remote-token"
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 'bold',
                fontSize: '0.875rem',
              }}
            >
              Remote Repository Token (optional)
            </label>
            <input
              id="remote-token"
              type="password"
              value={remoteToken}
              onChange={(e) => setRemoteToken(e.target.value)}
              placeholder="ghp_..."
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
              Personal access token for authentication when pushing to remote.
            </small>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
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
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={isSaving}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#eaecf0',
              color: '#202122',
              border: '1px solid #a2a9b1',
              borderRadius: '2px',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <RefreshCw size={16} />
            Reset
          </button>
        </div>
      </form>

      {/* Information */}
      <div
        style={{
          marginTop: '2rem',
          padding: '1rem',
          backgroundColor: '#fef6e8',
          border: '1px solid #f4c7a8',
          borderRadius: '2px',
        }}
      >
        <strong>Important:</strong> Configuration changes require an application restart to take effect.
        After saving, restart the backend service using <code style={{ backgroundColor: '#fff', padding: '2px 4px' }}>wikigit restart</code>
      </div>
    </div>
  )
}
