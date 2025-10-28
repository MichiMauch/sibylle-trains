import { useState, useEffect, useCallback, useRef } from 'react';
import type { Journey, StationboardResponse, Connection, ConnectionsResponse } from '@/types/transport';

export interface JourneyWithConnection extends Journey {
  aarauArrival?: string;
  aarauPlatform?: string | null;
  aarauPrognosisPlatform?: string | null;
  connections?: Connection[];
}

export type Direction = 'toZurich' | 'toMuhen';

export function useTrainData() {
  const [data, setData] = useState<StationboardResponse | null>(null);
  const [journeysWithConnections, setJourneysWithConnections] = useState<JourneyWithConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [direction, setDirection] = useState<Direction>('toZurich');
  const [isDirectionChanging, setIsDirectionChanging] = useState(false);

  const fetchingRef = useRef(false);
  const aarauDataCache = useRef<Journey[]>([]);
  const connectionsDataCache = useRef<JourneyWithConnection[]>([]);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const fetchStationboardRef = useRef<((mode: 'full' | 'quick') => Promise<void>) | null>(null);

  // Schedule automatic retry on error
  const scheduleRetry = (mode: 'full' | 'quick' = 'full') => {
    // Clear any existing retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }

    // Only retry up to 3 times
    if (retryCountRef.current >= 3) {
      console.log('❌ Max retries reached, stopping automatic retry');
      return;
    }

    retryCountRef.current += 1;
    const retryDelay = Math.min(5000 * retryCountRef.current, 15000); // 5s, 10s, 15s

    console.log(`🔄 Scheduling retry ${retryCountRef.current}/3 in ${retryDelay / 1000}s`);

    retryTimeoutRef.current = setTimeout(() => {
      console.log(`♻️ Retrying fetch (attempt ${retryCountRef.current}/3)`);
      if (fetchStationboardRef.current) {
        fetchStationboardRef.current(mode);
      }
    }, retryDelay);
  };

  const getAarauStop = (journey: Journey) => {
    const aarauStop = journey.passList?.find(
      (stop: any) => stop.station?.name === 'Aarau'
    );
    return aarauStop || null;
  };

  const fetchConnections = async (
    arrivalTime: string,
    destination: string,
    aarauStationboard: Journey[]
  ): Promise<Connection[]> => {
    try {
      const arrivalDate = new Date(arrivalTime);
      const arrivalTimestamp = arrivalDate.getTime();
      const minTransferTime = 4 * 60000;

      const allJourneys = aarauStationboard;

      const destinationTrains = allJourneys.filter((journey: Journey) => {
        const hasDestination = journey.to.includes(destination) ||
          journey.passList?.some((stop: any) => stop.station?.name === destination);

        if (!hasDestination) return false;

        const departureTimestamp = new Date(journey.stop.departure).getTime();
        const timeDiff = departureTimestamp - arrivalTimestamp;
        if (timeDiff < minTransferTime) return false;

        const destStop = journey.passList?.find((stop: any) => stop.station?.name === destination);
        if (destStop) {
          const destArrival = destStop.arrival || destStop.departure;
          if (destArrival) {
            const destArrivalTime = new Date(destArrival).getTime();
            if (destArrivalTime <= departureTimestamp) {
              return false;
            }
          }
        }

        return true;
      });

      const connections: Connection[] = destinationTrains.slice(0, 3).map((journey: Journey) => {
        let destStop = journey.passList?.find(
          (stop: any) => stop.station?.name === destination
        );

        const destArrival = destStop?.arrival || destStop?.departure || null;
        const destArrivalTimestamp = destStop?.arrivalTimestamp || destStop?.departureTimestamp || null;

        const getStationId = (stationName: string) => {
          if (stationName === 'Zürich HB') return '8503000';
          if (stationName === 'Muhen') return '8502211';
          return '8502113';
        };

        const getCoordinates = (stationName: string) => {
          if (stationName === 'Zürich HB') return { x: 47.377847, y: 8.540502 };
          if (stationName === 'Muhen') return { x: 47.363889, y: 8.043056 };
          return { x: 47.391361, y: 8.051284 };
        };

        const destCoords = getCoordinates(destination);
        const destId = getStationId(destination);

        return {
          from: {
            station: { id: '8502113', name: 'Aarau', score: null, coordinate: { type: 'WGS84', x: 47.391361, y: 8.051284 }, distance: null },
            arrival: null,
            arrivalTimestamp: null,
            departure: journey.stop.departure,
            departureTimestamp: new Date(journey.stop.departure).getTime(),
            delay: journey.stop.delay,
            platform: journey.stop.platform,
            prognosis: journey.stop.prognosis,
            realtimeAvailability: null,
            location: { id: '8502113', name: 'Aarau', score: null, coordinate: { type: 'WGS84', x: 47.391361, y: 8.051284 }, distance: null },
          },
          to: {
            station: { id: destId, name: destination, score: null, coordinate: { type: 'WGS84', x: destCoords.x, y: destCoords.y }, distance: null },
            arrival: destArrival,
            arrivalTimestamp: destArrivalTimestamp,
            departure: null,
            departureTimestamp: null,
            delay: null,
            platform: destStop?.platform || null,
            prognosis: { platform: null, arrival: null, departure: null, capacity1st: null, capacity2nd: null },
            realtimeAvailability: null,
            location: { id: destId, name: destination, score: null, coordinate: { type: 'WGS84', x: destCoords.x, y: destCoords.y }, distance: null },
          },
          duration: '00d00:30:00',
          transfers: 0,
          service: null,
          products: [`${journey.category} ${journey.number}`],
          capacity1st: null,
          capacity2nd: null,
          sections: [],
          finalDestination: journey.to,
        };
      });

      return connections;
    } catch (error) {
      console.error('Error fetching connections:', error);
      return [];
    }
  };

  const fetchConnectionsRoute = useCallback(async (mode: 'full' | 'quick' = 'full') => {
    try {
      if (mode === 'quick' && connectionsDataCache.current.length > 0) {
        console.log('⚡ Quick refresh: Using cached connections');
        setJourneysWithConnections(connectionsDataCache.current);
        setLastUpdate(new Date());
        return;
      }

      console.log('🔄 Full refresh: Fetching connections from API');
      const response = await fetch(`/api/connections?from=${encodeURIComponent('Zürich HB')}&to=${encodeURIComponent('Muhen')}&via=${encodeURIComponent('Aarau')}&limit=15`);

      if (!response.ok) {
        throw new Error('Failed to fetch connections');
      }

      const data: ConnectionsResponse = await response.json();

      const journeysWithConnectionsData = data.connections
        .filter(conn => conn.sections.length >= 2 && conn.sections[0].journey)
        .map((conn) => {
          const firstSection = conn.sections[0];
          const secondSection = conn.sections[1];

          if (!firstSection.journey) return null;

          const journey: Journey = {
            stop: {
              station: firstSection.departure.station,
              arrival: null,
              arrivalTimestamp: null,
              departure: firstSection.departure.departure!,
              departureTimestamp: firstSection.departure.departureTimestamp!,
              delay: firstSection.departure.delay || 0,
              platform: firstSection.departure.platform || '',
              prognosis: firstSection.departure.prognosis,
              realtimeAvailability: firstSection.departure.realtimeAvailability,
              location: firstSection.departure.location,
            },
            name: firstSection.journey.name,
            category: firstSection.journey.category,
            subcategory: firstSection.journey.subcategory,
            categoryCode: firstSection.journey.categoryCode,
            number: firstSection.journey.number,
            operator: firstSection.journey.operator,
            to: firstSection.journey.to,
            passList: firstSection.journey.passList || [],
            capacity1st: firstSection.journey.capacity1st,
            capacity2nd: firstSection.journey.capacity2nd,
          };

          const aarauArrival = firstSection.arrival.arrival;
          const aarauPlatform = firstSection.arrival.platform;
          const aarauPrognosisPlatform = firstSection.arrival.prognosis.platform;

          const connections: Connection[] = secondSection.journey ? [{
            from: {
              station: secondSection.departure.station,
              arrival: null,
              arrivalTimestamp: null,
              departure: secondSection.departure.departure,
              departureTimestamp: secondSection.departure.departureTimestamp,
              delay: secondSection.departure.delay,
              platform: secondSection.departure.platform,
              prognosis: secondSection.departure.prognosis,
              realtimeAvailability: secondSection.departure.realtimeAvailability,
              location: secondSection.departure.location,
            },
            to: {
              station: secondSection.arrival.station,
              arrival: secondSection.arrival.arrival,
              arrivalTimestamp: secondSection.arrival.arrivalTimestamp,
              departure: null,
              departureTimestamp: null,
              delay: secondSection.arrival.delay,
              platform: secondSection.arrival.platform,
              prognosis: secondSection.arrival.prognosis,
              realtimeAvailability: secondSection.arrival.realtimeAvailability,
              location: secondSection.arrival.location,
            },
            duration: conn.duration,
            transfers: 0,
            service: null,
            products: [`${secondSection.journey.category} ${secondSection.journey.number}`],
            capacity1st: secondSection.journey.capacity1st,
            capacity2nd: secondSection.journey.capacity2nd,
            sections: [secondSection],
            finalDestination: secondSection.journey.to,
          }] : [];

          return {
            ...journey,
            aarauArrival: aarauArrival || undefined,
            aarauPlatform: aarauPlatform,
            aarauPrognosisPlatform: aarauPrognosisPlatform,
            connections: connections.length > 0 ? connections : undefined,
          };
        })
        .filter((j) => j !== null) as JourneyWithConnection[];

      setJourneysWithConnections(journeysWithConnectionsData);
      connectionsDataCache.current = journeysWithConnectionsData;

      setData({
        station: {
          id: '8503000',
          name: 'Zürich HB',
          score: null,
          coordinate: { type: 'WGS84', x: 47.377847, y: 8.540502 },
          distance: null,
        },
        stationboard: [],
      });

      setError(null);
      setLastUpdate(new Date());
      retryCountRef.current = 0; // Reset retry counter on success
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Verbindungsfehler';
      console.error('❌ Fetch error:', errorMessage);
      setError(errorMessage);
      scheduleRetry(mode);
    } finally {
      setLoading(false);
      setIsDirectionChanging(false);
    }
  }, []);

  const fetchStationboard = useCallback(async (mode: 'full' | 'quick' = 'full') => {
    if (fetchingRef.current) {
      return;
    }

    fetchingRef.current = true;

    try {
      if (mode === 'full') {
        setLoading(true);
      }

      const startStation = direction === 'toZurich' ? 'Muhen' : 'Zürich HB';
      const intermediateStation = 'Aarau';
      const endStation = direction === 'toZurich' ? 'Zürich HB' : 'Muhen';

      if (direction === 'toMuhen') {
        await fetchConnectionsRoute(mode);
        return;
      }

      const response = await fetch(`/api/stationboard?station=${encodeURIComponent(startStation)}&limit=15`);

      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }

      const result: StationboardResponse = await response.json();
      setData(result);

      const aarauJourneys = result.stationboard.filter((journey: Journey) => {
        const goesToAarau = journey.to === intermediateStation ||
          journey.passList?.some((stop: any) => stop.station?.name === intermediateStation);

        if (!goesToAarau) return false;

        const aarauStop = journey.passList?.find(
          (stop: any) => stop.station?.name === intermediateStation
        );
        const hasValidArrival = aarauStop?.arrival != null;

        return hasValidArrival;
      });

      let aarauStationboard: Journey[] = [];

      if (aarauJourneys.length > 0) {
        const aarauLimit = mode === 'full' ? 100 : 30;
        const refreshLabel = mode === 'full' ? '🔄 Full refresh' : '⚡ Quick refresh';

        console.log(`${refreshLabel}: Fetching Aarau connections (limit=${aarauLimit})`);

        const aarauResponse = await fetch(`/api/stationboard?station=Aarau&limit=${aarauLimit}`);
        if (aarauResponse.ok) {
          const aarauData: StationboardResponse = await aarauResponse.json();
          aarauStationboard = aarauData.stationboard || [];

          if (mode === 'full') {
            aarauDataCache.current = aarauStationboard;
          }
        }
      }

      const journeysWithConnectionsData: JourneyWithConnection[] = await Promise.all(
        aarauJourneys.map(async (journey) => {
          const aarauStop = getAarauStop(journey);
          const aarauArrival = aarauStop?.arrival || null;
          let connections: Connection[] = [];

          if (aarauArrival && aarauStationboard.length > 0) {
            connections = await fetchConnections(aarauArrival, endStation, aarauStationboard);
          }

          return {
            ...journey,
            aarauArrival: aarauArrival || undefined,
            aarauPlatform: aarauStop?.platform || null,
            aarauPrognosisPlatform: aarauStop?.prognosis?.platform || null,
            connections: connections.length > 0 ? connections : undefined,
          };
        })
      );

      setJourneysWithConnections(journeysWithConnectionsData);
      setError(null);
      setLastUpdate(new Date());
      retryCountRef.current = 0; // Reset retry counter on success
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Verbindungsfehler';
      console.error('❌ Fetch error:', errorMessage);
      setError(errorMessage);
      scheduleRetry(mode);
    } finally {
      setLoading(false);
      setIsDirectionChanging(false);
      fetchingRef.current = false;
    }
  }, [direction, fetchConnectionsRoute]);

  // Store fetchStationboard in ref for retry logic
  fetchStationboardRef.current = fetchStationboard;

  useEffect(() => {
    aarauDataCache.current = [];
    connectionsDataCache.current = [];

    let quickRefreshInterval: NodeJS.Timeout | null = null;
    let fullRefreshInterval: NodeJS.Timeout | null = null;
    let isVisible = !document.hidden;

    // Initial fetch
    fetchStationboard('full');

    // Start intervals
    const startIntervals = () => {
      if (quickRefreshInterval) clearInterval(quickRefreshInterval);
      if (fullRefreshInterval) clearInterval(fullRefreshInterval);

      quickRefreshInterval = setInterval(() => {
        if (!document.hidden) {
          fetchStationboard('quick');
        }
      }, 30000);

      fullRefreshInterval = setInterval(() => {
        if (!document.hidden) {
          fetchStationboard('full');
        }
      }, 180000);
    };

    // Stop intervals
    const stopIntervals = () => {
      if (quickRefreshInterval) {
        clearInterval(quickRefreshInterval);
        quickRefreshInterval = null;
      }
      if (fullRefreshInterval) {
        clearInterval(fullRefreshInterval);
        fullRefreshInterval = null;
      }
    };

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, stop intervals
        console.log('📱 App hidden, pausing fetches');
        stopIntervals();
        isVisible = false;
      } else {
        // Page is visible again
        console.log('📱 App visible, resuming fetches');
        isVisible = true;

        // Fetch fresh data immediately
        fetchStationboard('full');

        // Restart intervals
        startIntervals();
      }
    };

    // Start intervals initially
    startIntervals();

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopIntervals();
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      // Clear retry timeout on cleanup
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction]);

  const toggleDirection = () => {
    setIsDirectionChanging(true);
    setDirection(prev => prev === 'toZurich' ? 'toMuhen' : 'toZurich');

    // Clear any pending retries when changing direction
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    retryCountRef.current = 0;
  };

  return {
    data,
    journeysWithConnections,
    loading,
    error,
    lastUpdate,
    direction,
    isDirectionChanging,
    toggleDirection
  };
}
