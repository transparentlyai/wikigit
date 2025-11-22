'use client'

import { useEffect } from 'react'
import { useWikiStore } from '@/lib/store'
import { api } from '@/lib/api'

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const setAppName = useWikiStore((state) => state.setAppName)

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await api.getConfig()
        setAppName(config.app_name)
      } catch (error) {
        console.error('Failed to fetch config:', error)
      }
    }

    fetchConfig()
  }, [setAppName])

  return <>{children}</>
}
