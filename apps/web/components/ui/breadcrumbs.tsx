'use client';

/**
 * Breadcrumbs component
 * Shows navigation path with chevron separators
 */

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-gray-500 mb-6">
      <Link
        href="/"
        className="hover:text-gray-800 cursor-pointer transition-colors"
      >
        Home
      </Link>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <ChevronRight size={12} className="opacity-50" />
          {item.href && i < items.length - 1 ? (
            <Link
              href={item.href}
              className="hover:text-gray-800 cursor-pointer transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className={i === items.length - 1 ? 'text-gray-900 font-medium' : ''}>
              {item.label}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
