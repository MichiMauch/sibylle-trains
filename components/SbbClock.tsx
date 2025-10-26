'use client';

import { useEffect, useRef } from 'react';

interface SbbClockProps {
  size?: number;
  darkBackground?: boolean;
  fps?: number;
}

declare global {
  interface Window {
    sbbUhr: any;
  }
}

export default function SbbClock({ size = 80, darkBackground = true, fps = 30 }: SbbClockProps) {
  const clockRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load the SBB clock script
    const script = document.createElement('script');
    script.src = '/sbbUhr-1.3.js';
    script.async = true;

    script.onload = () => {
      // Initialize the clock after script loads
      if (typeof window.sbbUhr === 'function' && containerRef.current) {
        clockRef.current = new window.sbbUhr('sbb-clock-container', darkBackground, fps);
        clockRef.current.start();
      }
    };

    document.body.appendChild(script);

    // Cleanup
    return () => {
      if (clockRef.current && clockRef.current.stop) {
        clockRef.current.stop();
      }
      document.body.removeChild(script);
    };
  }, [darkBackground, fps]);

  return (
    <div
      ref={containerRef}
      id="sbb-clock-container"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        position: 'relative'
      }}
    />
  );
}
