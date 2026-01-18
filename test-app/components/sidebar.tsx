/**
 * Sidebar Component
 * 
 * Sidebar navigation component using Shadcn/UI components
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FlaskConical, Image, Sparkles, Layers, Workflow, GitMerge, Wand2, Settings, Link2, FileText, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarItem {
  title: string;
  href: string;
  icon?: React.ReactNode;
}

const sidebar_items: SidebarItem[] = [
  {
    title: 'Home',
    href: '/',
    icon: <Home className="h-4 w-4" />,
  },
  {
    title: 'Text → Text',
    href: '/llm-test',
    icon: <FlaskConical className="h-4 w-4" />,
  },
  {
    title: 'Image → Text',
    href: '/llm-test-image',
    icon: <Image className="h-4 w-4" />,
  },
  {
    title: 'Document → Text',
    href: '/llm-test-document',
    icon: <FileText className="h-4 w-4" />,
  },
  {
    title: 'Text → Image',
    href: '/llm-test-image-gen',
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    title: 'Image → Image',
    href: '/llm-test-image-image',
    icon: <Wand2 className="h-4 w-4" />,
  },
  {
    title: 'Image+Image → Image',
    href: '/llm-test-combine-images',
    icon: <Layers className="h-4 w-4" />,
  },
  {
    title: 'Text→Image→Text',
    href: '/llm-test-text-image-text',
    icon: <Workflow className="h-4 w-4" />,
  },
  {
    title: 'Images→Image→Text',
    href: '/llm-test-image-image-text',
    icon: <GitMerge className="h-4 w-4" />,
  },
  {
    title: 'Prompt Chain',
    href: '/llm-test-prompt-chain',
    icon: <Link2 className="h-4 w-4" />,
  },
  {
    title: 'Dynamic Prompts',
    href: '/llm-test-dynamic-extract',
    icon: <Zap className="h-4 w-4" />,
  },
  {
    title: 'Prompt Config',
    href: '/prompt-config',
    icon: <Settings className="h-4 w-4" />,
  },
];

/**
 * Sidebar component - provides navigation menu
 */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="cls_sidebar_container flex h-full w-64 flex-col border-r bg-background">
      <div className="cls_sidebar_header p-4">
        <h2 className="cls_sidebar_title text-lg font-semibold">
          hazo_llm_api
        </h2>
      </div>
      <nav className="cls_sidebar_nav flex-1 space-y-1 p-2">
        {sidebar_items.map((item) => {
          const is_active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'cls_sidebar_item flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                is_active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              {item.icon}
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

