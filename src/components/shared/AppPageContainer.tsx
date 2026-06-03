import React from 'react';

interface AppPageContainerProps {
  children: React.ReactNode;
  className?: string;
  dir?: 'rtl' | 'ltr';
}

/**
 * Universal safe layout container conforming to responsive design system standards.
 * Ensures consistent gutter spacing on mobile (px-4), tablet (px-6), and desktop (px-8).
 */
export const AppPageContainer: React.FC<AppPageContainerProps> = ({
  children,
  className = '',
  dir = 'rtl',
}) => {
  return (
    <div
      className={`w-full max-w-full mx-auto px-4 sm:px-6 md:px-8 font-cairo ${className}`}
      dir={dir}
    >
      {children}
    </div>
  );
};

export default AppPageContainer;
