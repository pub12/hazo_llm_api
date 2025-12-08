/**
 * Layout Component
 * 
 * Main layout component that provides a consistent structure
 * for applications using the hazo_llm_api package
 */

'use client';

import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
}

/**
 * Layout component - provides a consistent page structure
 * @param children - Main content to be displayed
 * @param sidebar - Optional sidebar component
 * @param header - Optional header component
 */
export function Layout({ children, sidebar, header }: LayoutProps) {
  return (
    <div className="cls_layout_container flex h-screen w-full">
      {sidebar && (
        <aside className="cls_layout_sidebar">
          {sidebar}
        </aside>
      )}
      <div className="cls_layout_main flex flex-1 flex-col">
        {header && (
          <header className="cls_layout_header">
            {header}
          </header>
        )}
        <main className="cls_layout_content flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

