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
    bgColor: 'bg-blue-500/5',
    titleColor: 'text-blue-600',
    icon: Info,
    iconColor: 'text-blue-500',
    label: 'Note',
  },
  warning: {
    borderColor: 'border-amber-500',
    bgColor: 'bg-amber-500/5',
    titleColor: 'text-amber-700',
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
    label: 'Warning',
  },
  success: {
    borderColor: 'border-green-500',
    bgColor: 'bg-green-500/5',
    titleColor: 'text-green-600',
    icon: Lightbulb,
    iconColor: 'text-green-500',
    label: 'Tip',
  },
  important: {
    borderColor: 'border-purple-500',
    bgColor: 'bg-purple-500/5',
    titleColor: 'text-purple-600',
    icon: AlertCircle,
    iconColor: 'text-purple-500',
    label: 'Important',
  },
  caution: {
    borderColor: 'border-red-500',
    bgColor: 'bg-red-500/5',
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
    <div className={`my-4 pl-4 pr-3 py-3 border-l-4 rounded ${style.borderColor} ${style.bgColor}`}>
      <div className="flex items-center gap-2">
        <div className={`flex-shrink-0 ${style.iconColor}`}>
          <Icon size={16} />
        </div>
        <div className={`font-semibold text-sm ${style.titleColor} leading-none`}>
          {displayTitle}
        </div>
      </div>
      <div className="callout-content text-sm text-gray-700 pl-6 [&>*]:my-0 [&>*]:py-0 [&>h1]:mt-[0.7rem] [&>h2]:mt-[0.7rem] [&>h3]:mt-[0.7rem] [&>h4]:mt-[0.7rem] [&>h5]:mt-[0.7rem] [&>h6]:mt-[0.7rem] [&>p]:mt-[0.5rem] [&>p]:mb-[0.5rem] [&>p:empty]:hidden [&>p]:leading-tight [&>h1]:leading-tight [&>h2]:leading-tight [&>h3]:leading-tight [&>h4]:leading-tight [&>h5]:leading-tight [&>h6]:leading-tight [&>p:last-child]:mb-0 [&>p:last-child]:pb-0">
        {children}
      </div>
    </div>
  );
}
