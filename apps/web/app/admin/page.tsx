'use client'

import { MainLayout } from '@/components/layout/main-layout'
import { SearchManager } from '@/components/admin/search-manager'
import { ConfigManager } from '@/components/admin/config-manager'

export default function AdminPage() {
  return (
    <MainLayout>
      <div className="wiki-main">
        <div className="wiki-content">
          <h1 className="wiki-page-title">Admin Panel</h1>
          <p style={{ marginBottom: '2rem', color: '#54595d' }}>
            Manage your wiki search index and configuration settings.
          </p>

          <SearchManager />

          <hr style={{ margin: '3rem 0', border: 'none', borderTop: '1px solid #a2a9b1' }} />

          <ConfigManager />
        </div>
      </div>
    </MainLayout>
  )
}
