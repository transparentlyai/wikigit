'use client';

/**
 * Callout component for info, warning, and success messages
 * Flat design with colored backgrounds and icons
 */

import { Info, AlertCircle, CheckSquare } from 'lucide-react';

type CalloutType = 'info' | 'warning' | 'success';

interface CalloutProps {
  type?: CalloutType;
  title?: string;
  children: React.ReactNode;
}

const styles = {
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-900',
    icon: Info,
    iconColor: 'text-blue-500',
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-900',
    icon: AlertCircle,
    iconColor: 'text-amber-500',
  },
  success: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-900',
    icon: CheckSquare,
    iconColor: 'text-green-500',
  },
};

export function Callout({ type = 'info', title, children }: CalloutProps) {
  const style = styles[type];
  const Icon = style.icon;

  return (
    <div
      className={`my-6 p-4 rounded-lg border ${style.border} ${style.bg} flex gap-3 items-start`}
    >
      <div className={`mt-0.5 flex-shrink-0 ${style.iconColor}`}>
        <Icon size={18} />
      </div>
      <div>
        {title && (
          <div className={`font-semibold text-sm ${style.text} mb-1`}>
            {title}
          </div>
        )}
        <div className={`text-sm ${style.text} opacity-90 leading-relaxed`}>
          {children}
        </div>
      </div>
    </div>
  );
}
