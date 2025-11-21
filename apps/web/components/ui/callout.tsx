'use client';

import { Info, AlertCircle, Lightbulb, AlertTriangle, OctagonAlert } from 'lucide-react';

type CalloutType = 'info' | 'warning' | 'success' | 'important' | 'caution';

interface CalloutProps {
  type?: CalloutType;
  title?: string;
  children: React.ReactNode;
}

const styles = {
  info: {
    borderColor: 'border-blue-500',
    titleColor: 'text-blue-600',
    icon: Info,
    iconColor: 'text-blue-500',
    label: 'Note',
  },
  warning: {
    borderColor: 'border-amber-500',
    titleColor: 'text-amber-700',
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
    label: 'Warning',
  },
  success: {
    borderColor: 'border-green-500',
    titleColor: 'text-green-600',
    icon: Lightbulb,
    iconColor: 'text-green-500',
    label: 'Tip',
  },
  important: {
    borderColor: 'border-purple-500',
    titleColor: 'text-purple-600',
    icon: AlertCircle,
    iconColor: 'text-purple-500',
    label: 'Important',
  },
  caution: {
    borderColor: 'border-red-500',
    titleColor: 'text-red-600',
    icon: OctagonAlert,
    iconColor: 'text-red-500',
    label: 'Caution',
  },
};

export function Callout({ type = 'info', title, children }: CalloutProps) {
  const style = styles[type];
  const Icon = style.icon;
  const displayTitle = title || style.label;

  return (
    <div className={`my-4 pl-4 pr-3 py-3 border-l-4 ${style.borderColor} bg-white`}>
      <div className="flex items-center gap-2 mb-1">
        <div className={`flex-shrink-0 ${style.iconColor}`}>
          <Icon size={16} />
        </div>
        <div className={`font-semibold text-sm ${style.titleColor}`}>
          {displayTitle}
        </div>
      </div>
      <div className="text-sm text-gray-700 leading-relaxed">
        {children}
      </div>
    </div>
  );
}
