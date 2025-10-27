'use client';

import { useEffect, useRef, useState } from 'react';

interface SbbClockProps {
  size?: number;
  darkBackground?: boolean;
  fps?: number;
}

declare global {
  interface Window {
    sbbUhr: any;
    sbbUhrScriptLoaded?: boolean;
  }
}

let clockIdCounter = 0;

export default function SbbClock({ size = 80, darkBackground = true, fps = 30 }: SbbClockProps) {
  const clockRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerId] = useState(() => `sbb-clock-container-${clockIdCounter++}`);

  useEffect(() => {
    const initClock = () => {
      if (typeof window.sbbUhr === 'function' && containerRef.current) {
        clockRef.current = new window.sbbUhr(containerId, darkBackground, fps);
        clockRef.current.start();
      }
    };

    // Check if script is already loaded
    if (window.sbbUhrScriptLoaded) {
      initClock();
    } else {
      // Load the SBB clock script only once
      const existingScript = document.querySelector('script[src="/sbbUhr-1.3.js"]');

      if (existingScript) {
        existingScript.addEventListener('load', initClock);
      } else {
        const script = document.createElement('script');
        script.src = '/sbbUhr-1.3.js';
        script.async = true;

        script.onload = () => {
          window.sbbUhrScriptLoaded = true;
          initClock();
        };

        document.body.appendChild(script);
      }
    }

    // Cleanup
    return () => {
      if (clockRef.current && clockRef.current.stop) {
        clockRef.current.stop();
      }
    };
  }, [containerId, darkBackground, fps]);

  return (
    <div
      ref={containerRef}
      id={containerId}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        position: 'relative'
      }}
    />
  );
}
