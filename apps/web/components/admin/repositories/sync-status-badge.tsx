'use client'

import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react'

export type SyncStatus = 'synced' | 'error' | 'pending' | 'never' | 'unavailable'

interface SyncStatusBadgeProps {
  status: SyncStatus
  tooltip?: string
}

export function SyncStatusBadge({ status, tooltip }: SyncStatusBadgeProps) {
  const statusConfig = {
    synced: {
      color: '#00af89',
      bgColor: '#e6f7f3',
      borderColor: '#00af89',
      icon: CheckCircle,
      label: 'Synced',
    },
    error: {
      color: '#d33',
      bgColor: '#fee7e6',
      borderColor: '#d33',
      icon: XCircle,
      label: 'Error',
    },
    pending: {
      color: '#fc3',
      bgColor: '#fef6e7',
      borderColor: '#fc3',
      icon: Clock,
      label: 'Pending',
    },
    never: {
      color: '#72777d',
      bgColor: '#f8f9fa',
      borderColor: '#a2a9b1',
      icon: AlertCircle,
      label: 'Never',
    },
    unavailable: {
      color: '#72777d',
      bgColor: '#f8f9fa',
      borderColor: '#a2a9b1',
      icon: AlertCircle,
      label: 'Unavailable',
    },
  }

  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <span
      title={tooltip || config.label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.25rem 0.5rem',
        fontSize: '0.75rem',
        fontWeight: 'bold',
        color: config.color,
        backgroundColor: config.bgColor,
        border: `1px solid ${config.borderColor}`,
        borderRadius: '2px',
        cursor: tooltip ? 'help' : 'default',
      }}
    >
      <Icon size={12} />
      {config.label}
    </span>
  )
}
