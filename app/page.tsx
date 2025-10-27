'use client';

import { useIsMobile } from '@/hooks/useIsMobile';
import Stationboard from '@/components/Stationboard';
import MobileStationboard from '@/components/MobileStationboard';

export default function Home() {
  const isMobile = useIsMobile();

  return isMobile ? <MobileStationboard /> : <Stationboard />;
}
