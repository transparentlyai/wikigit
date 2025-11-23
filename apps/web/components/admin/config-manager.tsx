'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { Settings, Save, RefreshCw } from 'lucide-react';
import type { ConfigData } from '@/types/api';
import { HomePageSelector } from './home-page-selector';

export function ConfigManager() {
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [appName, setAppName] = useState('');
  const [admins, setAdmins] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      const configData = await api.getConfig();
      setConfig(configData);
      setAppName(configData.app_name);
      setAdmins(configData.admins.join('\n'));
    } catch (error: any) {
      toast.error(error.message || 'Failed to load configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsSaving(true);

      const adminsList = admins
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      const updatedConfig = await api.updateConfig({
        app: {
          name: appName,
          admins: adminsList,
        },
      });

      setConfig(updatedConfig);
      toast.success('Configuration saved successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (config) {
      setAppName(config.app_name);
      setAdmins(config.admins.join('\n'));
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p style={{ color: '#54595d' }}>Loading configuration...</p>
      </div>
    );
  }

  if (!config) {
    return null;
  }

  return (
    <div>
      <h2
        style={{
          fontSize: '1.5rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <Settings size={24} />
        Configuration Settings
      </h2>

      {/* Home Page Configuration */}
      <HomePageSelector config={config} onSave={fetchConfig} />

      {/* Application Settings Form */}
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
              Admin users have access to this admin panel and can manage repositories.
            </small>
          </div>
        </div>

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
    </div>
  );
}
