import { useState, useEffect } from 'react';

export function useBreakpoint(breakpoint: number): boolean {
  const [isBelow, setIsBelow] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  );

  useEffect(() => {
    const handleResize = () => setIsBelow(window.innerWidth < breakpoint);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  return isBelow;
}
