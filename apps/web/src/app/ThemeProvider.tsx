import { useEffect, type ReactNode } from 'react';

/** This personal clock always uses the light palette. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);
  return <>{children}</>;
}
