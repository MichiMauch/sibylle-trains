'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { Journey, StationboardResponse, Connection, ConnectionsResponse } from '@/types/transport';
import { isTrainRunning } from '@/utils/trainPosition';
import TrainBadge from './TrainBadge';
import PlatformBadge from './PlatformBadge';
import SbbClock from './SbbClock';

// Dynamic import to avoid SSR issues with Leaflet
const TrainMapModal = dynamic(() => import('./TrainMapModal'), { ssr: false });

interface JourneyWithConnection extends Journey {
  aarauArrival?: string;
  aarauPlatform?: string | null;
  aarauPrognosisPlatform?: string | null;
  connections?: Connection[];
}

type Direction = 'toZurich' | 'toMuhen';

export default function Stationboard() {
  const [data, setData] = useState<StationboardResponse | null>(null);
  const [journeysWithConnections, setJourneysWithConnections] = useState<JourneyWithConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [selectedJourney, setSelectedJourney] = useState<Journey | null>(null);
  const [openAccordions, setOpenAccordions] = useState<Set<number>>(new Set([0]));
  const [direction, setDirection] = useState<Direction>('toZurich');
  const fetchingRef = useRef(false);
  const aarauDataCache = useRef<Journey[]>([]);
  const connectionsDataCache = useRef<JourneyWithConnection[]>([]);

  const fetchConnectionsRoute = useCallback(async (mode: 'full' | 'quick' = 'full') => {
    try {
      if (mode === 'quick' && connectionsDataCache.current.length > 0) {
        // Quick refresh: Use cached connections data
        console.log('⚡ Quick refresh: Using cached connections');
        setJourneysWithConnections(connectionsDataCache.current);
        setLastUpdate(new Date());
        return;
      }

      // Full refresh: Fetch connections from Zürich HB to Muhen via Aarau
      console.log('🔄 Full refresh: Fetching connections from API');
      const response = await fetch(`/api/connections?from=${encodeURIComponent('Zürich HB')}&to=${encodeURIComponent('Muhen')}&via=${encodeURIComponent('Aarau')}&limit=15`);

      if (!response.ok) {
        throw new Error('Failed to fetch connections');
      }

      const data: ConnectionsResponse = await response.json();

      // Convert connections to Journey format
      const journeysWithConnectionsData = data.connections
        .filter(conn => conn.sections.length >= 2 && conn.sections[0].journey) // Must have at least 2 sections with first being a train
        .map((conn) => {
          const firstSection = conn.sections[0]; // Zürich HB → Aarau
          const secondSection = conn.sections[1]; // Aarau → Muhen

          if (!firstSection.journey) return null;

          // Create a Journey object from the connection
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

          // Get Aarau arrival info from first section
          const aarauArrival = firstSection.arrival.arrival;
          const aarauPlatform = firstSection.arrival.platform;
          const aarauPrognosisPlatform = firstSection.arrival.prognosis.platform;

          // Get Muhen connection info from second section
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

      // Cache for quick refreshes
      connectionsDataCache.current = journeysWithConnectionsData;

      // Set data with fake station for consistency
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStationboard = useCallback(async (mode: 'full' | 'quick' = 'full') => {
    // Prevent multiple simultaneous fetches
    if (fetchingRef.current) {
      console.log('Already fetching, skipping...');
      return;
    }

    fetchingRef.current = true;

    try {
      // Only show loading indicator for full refresh
      if (mode === 'full') {
        setLoading(true);
      }

      // Determine start and end stations based on direction
      const startStation = direction === 'toZurich' ? 'Muhen' : 'Zürich HB';
      const intermediateStation = 'Aarau';
      const endStation = direction === 'toZurich' ? 'Zürich HB' : 'Muhen';

      // For Zürich → Muhen, use Connection API instead of Stationboard
      if (direction === 'toMuhen') {
        await fetchConnectionsRoute(mode);
        return;
      }

      // Use stationboard for Muhen → Zürich
      const response = await fetch(`/api/stationboard?station=${encodeURIComponent(startStation)}&limit=15`);

      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }

      const result: StationboardResponse = await response.json();
      setData(result);

      // Filter for trains going through Aarau with valid arrival time
      const aarauJourneys = result.stationboard.filter((journey: Journey) => {
        // Check if train goes to or through Aarau
        const goesToAarau = journey.to === intermediateStation ||
          journey.passList?.some((stop: any) => stop.station?.name === intermediateStation);

        if (!goesToAarau) return false;

        // Check if we have a valid arrival time in Aarau
        const aarauStop = journey.passList?.find(
          (stop: any) => stop.station?.name === intermediateStation
        );
        const hasValidArrival = aarauStop?.arrival != null;

        return hasValidArrival;
      });

      let aarauStationboard: Journey[] = [];

      if (aarauJourneys.length > 0) {
        // Determine limit based on refresh mode
        const aarauLimit = mode === 'full' ? 100 : 30;
        const refreshLabel = mode === 'full' ? '🔄 Full refresh' : '⚡ Quick refresh';

        console.log(`${refreshLabel}: Fetching Aarau connections (limit=${aarauLimit})`);

        const aarauResponse = await fetch(`/api/stationboard?station=Aarau&limit=${aarauLimit}`);
        if (aarauResponse.ok) {
          const aarauData: StationboardResponse = await aarauResponse.json();
          aarauStationboard = aarauData.stationboard || [];

          // Only update cache on full refresh
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [direction, fetchConnectionsRoute]);

  useEffect(() => {
    // Reset caches when direction changes
    aarauDataCache.current = [];
    connectionsDataCache.current = [];

    // Initial full refresh
    fetchStationboard('full');

    // Quick refresh every 30 seconds
    // - Muhen → Zürich: Fetches Muhen + Aarau (limit=30)
    // - Zürich → Muhen: Uses cached connections data
    const quickRefreshInterval = setInterval(() => {
      fetchStationboard('quick');
    }, 30000);

    // Full refresh every 3 minutes
    // - Muhen → Zürich: Fetches Muhen + Aarau (limit=100)
    // - Zürich → Muhen: Fetches complete connections via API
    const fullRefreshInterval = setInterval(() => {
      fetchStationboard('full');
    }, 180000);

    return () => {
      clearInterval(quickRefreshInterval);
      clearInterval(fullRefreshInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction]); // Only re-run when direction changes

  useEffect(() => {
    // Update current time every minute for accurate "in X min" display
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timeInterval);
  }, []);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('de-CH', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDelayColor = (delay: number) => {
    if (delay === 0) return 'text-green-400';
    if (delay > 0 && delay <= 3) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getDelayText = (delay: number) => {
    if (delay === 0) return 'Pünktlich';
    return `+${delay} Min`;
  };

  const getMinutesUntil = (dateString: string) => {
    const now = new Date();
    const departure = new Date(dateString);
    const diffMs = departure.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    return diffMins;
  };

  const toggleAccordion = (index: number) => {
    setOpenAccordions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const toggleDirection = () => {
    setDirection(prev => prev === 'toZurich' ? 'toMuhen' : 'toZurich');
    setOpenAccordions(new Set([0])); // Reset to first accordion open when switching
  };

  const getAarauStop = (journey: Journey) => {
    // Find Aarau in the passList
    const aarauStop = journey.passList?.find(
      (stop: any) => stop.station?.name === 'Aarau'
    );
    return aarauStop || null;
  };

  const getAarauArrival = (journey: Journey): string | null => {
    const aarauStop = getAarauStop(journey);
    return aarauStop?.arrival || null;
  };

  const fetchConnections = async (arrivalTime: string, destination: string, aarauStationboard: Journey[]): Promise<Connection[]> => {
    try {
      const arrivalDate = new Date(arrivalTime);
      const arrivalTimestamp = arrivalDate.getTime();
      const minTransferTime = 4 * 60000; // 4 minutes in milliseconds

      console.log('Finding connections for arrival time:', arrivalTime, 'to', destination);

      // Use the pre-fetched Aarau stationboard data instead of making another API call
      const allJourneys = aarauStationboard;

      // Filter trains going to or via the destination
      const destinationTrains = allJourneys.filter((journey: Journey) => {
        // Check if destination is the final destination OR a stop on the route
        const hasDestination = journey.to.includes(destination) ||
          journey.passList?.some((stop: any) => stop.station?.name === destination);

        if (!hasDestination) return false;

        // Check if departure is at least 4 minutes after arrival in Aarau
        const departureTimestamp = new Date(journey.stop.departure).getTime();
        const timeDiff = departureTimestamp - arrivalTimestamp;
        if (timeDiff < minTransferTime) return false;

        // IMPORTANT: Check if destination comes AFTER Aarau on the route
        // (to avoid showing trains that go FROM destination TO Aarau)
        const destStop = journey.passList?.find((stop: any) => stop.station?.name === destination);
        if (destStop) {
          const destArrival = destStop.arrival || destStop.departure;
          if (destArrival) {
            const destArrivalTime = new Date(destArrival).getTime();
            // Destination arrival must be AFTER departure from Aarau
            if (destArrivalTime <= departureTimestamp) {
              return false; // This train goes through destination before Aarau
            }
          }
        }

        return true;
      });

      console.log(`Found ${destinationTrains.length} trains to ${destination}`);

      // Convert Journey objects to Connection objects
      const connections: Connection[] = destinationTrains.slice(0, 3).map((journey: Journey) => {
        // Find destination in passList to get arrival time
        let destStop = journey.passList?.find(
          (stop: any) => stop.station?.name === destination
        );

        // If destination is not in passList but is the final destination, use the stop data
        if (!destStop && journey.to.includes(destination)) {
          console.log(`${destination} is destination for ${journey.category} ${journey.number}, but not in passList`);
        }

        // Get arrival time: prefer arrival, fallback to departure (for through trains)
        const destArrival = destStop?.arrival || destStop?.departure || null;
        const destArrivalTimestamp = destStop?.arrivalTimestamp || destStop?.departureTimestamp || null;

        // Get destination station ID based on name
        const getStationId = (stationName: string) => {
          if (stationName === 'Zürich HB') return '8503000';
          if (stationName === 'Muhen') return '8502211';
          return '8502113'; // Aarau default
        };

        // Get destination coordinates (simplified - in production would fetch from API)
        const getCoordinates = (stationName: string) => {
          if (stationName === 'Zürich HB') return { x: 47.377847, y: 8.540502 };
          if (stationName === 'Muhen') return { x: 47.363889, y: 8.043056 };
          return { x: 47.391361, y: 8.051284 }; // Aarau default
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
          finalDestination: journey.to, // Final destination of the train
        };
      });

      return connections;
    } catch (error) {
      console.error('Error fetching connections:', error);
      return [];
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Lade Abfahrtszeiten...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-red-600">Fehler: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: '#2E327B' }}>
      <div className="max-w-5xl mx-auto">
        <div className="rounded-lg shadow-lg overflow-hidden border border-white" style={{ backgroundColor: '#2E327B' }}>
          {/* Header */}
          <div className="text-white p-6 flex items-center gap-6 border-b border-white" style={{ backgroundColor: '#2E327B' }}>
            {/* SBB Clock */}
            <div className="flex-shrink-0">
              <SbbClock size={80} darkBackground={true} fps={30} />
            </div>

            {/* Title and Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">
                  {direction === 'toZurich'
                    ? 'Muhen → Aarau → Zürich HB'
                    : 'Zürich HB → Aarau → Muhen'
                  }
                </h1>
                {/* Direction Toggle Button */}
                <button
                  onClick={toggleDirection}
                  className="flex items-center justify-center w-10 h-10 bg-white rounded-full hover:bg-gray-200 transition-colors"
                  title="Richtung wechseln"
                >
                  <img
                    src="/icons/arrow-change-small.svg"
                    alt="Richtung wechseln"
                    className="w-6 h-6"
                  />
                </button>
              </div>
              <p className="text-sm opacity-90">
                Letzte Aktualisierung: {lastUpdate.toLocaleTimeString('de-CH')}
              </p>
            </div>
          </div>

          {/* Accordion List */}
          <div className="divide-y divide-white">
            {journeysWithConnections.map((journey: JourneyWithConnection, index: number) => {
              const hasConnections = journey.connections && journey.connections.length > 0;
              const isOpen = openAccordions.has(index);

              return (
                <div key={index} style={{ backgroundColor: isOpen ? '#1E2270' : '#2E327B' }}>
                  {/* Main Row */}
                  <div
                    className={`px-6 py-4 flex items-center justify-between cursor-pointer transition-colors ${hasConnections ? '' : 'cursor-default'}`}
                    style={{ backgroundColor: isOpen ? '#1E2270' : '#2E327B' }}
                    onMouseEnter={(e) => hasConnections && !isOpen && (e.currentTarget.style.backgroundColor = '#3E427B')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = isOpen ? '#1E2270' : '#2E327B')}
                    onClick={() => hasConnections && toggleAccordion(index)}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {/* Train Badge with Time and Map Icon above */}
                      <div className="flex flex-col items-center gap-1">
                        {/* Time and Map Icon above train badge */}
                        <div className="flex items-center gap-2">
                          {index === 0 && (
                            <span className="text-sm font-medium text-white">
                              in {getMinutesUntil(journey.stop.departure)} Min
                            </span>
                          )}
                          {isTrainRunning(journey.passList || []) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedJourney(journey);
                              }}
                              className="text-white hover:text-gray-300 transition-colors"
                              title="Zug auf Karte anzeigen"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                              </svg>
                            </button>
                          )}
                        </div>
                        {/* Train Badge */}
                        <TrainBadge category={journey.category} number={journey.number} />
                      </div>

                      {/* Departure Time */}
                      <div className="flex items-center gap-2">
                        <span className="text-base font-semibold text-white">
                          {formatTime(journey.stop.departure)}
                        </span>
                      </div>

                      {/* Start Station Platform Badge */}
                      <PlatformBadge platform={journey.stop.prognosis.platform || journey.stop.platform} />

                      {/* Arrow + Aarau Arrival + Aarau Platform */}
                      {journey.aarauArrival && (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-300">→</span>
                            <span className="text-sm text-gray-300">Aarau</span>
                            <span className="text-sm font-medium text-white">
                              {formatTime(journey.aarauArrival)}
                            </span>
                          </div>

                          {/* Aarau Platform Badge */}
                          <PlatformBadge platform={journey.aarauPrognosisPlatform || journey.aarauPlatform} />
                        </>
                      )}

                      {/* Hints - ganz am Ende */}
                      <div className="flex items-center gap-2">
                        {/* Start Station Platform Change */}
                        {journey.stop.platform && journey.stop.prognosis.platform &&
                         journey.stop.platform !== journey.stop.prognosis.platform && (
                          <div className="flex items-center gap-1">
                            <img
                              src="/icons/platform-change.svg"
                              alt="Gleisänderung"
                              className="h-5 w-auto"
                            />
                            <span className="text-xs text-gray-300">Gleisänderung</span>
                          </div>
                        )}

                        {/* Aarau Platform Change */}
                        {journey.aarauPlatform && journey.aarauPrognosisPlatform &&
                         journey.aarauPlatform !== journey.aarauPrognosisPlatform && (
                          <div className="flex items-center gap-1">
                            <img
                              src="/icons/platform-change.svg"
                              alt="Gleisänderung Aarau"
                              className="h-5 w-auto"
                            />
                            <span className="text-xs text-gray-300">Gleisänderung</span>
                          </div>
                        )}

                        {/* Delay */}
                        <span className={`text-sm font-semibold ${getDelayColor(journey.stop.delay)}`}>
                          {getDelayText(journey.stop.delay)}
                        </span>
                      </div>
                    </div>

                    {/* Accordion Arrow */}
                    {hasConnections && (
                      <svg
                        className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </div>

                  {/* Accordion Content */}
                  {hasConnections && isOpen && (
                    <div className="px-12 py-4" style={{ backgroundColor: '#1E2270', borderTop: '2px dotted white' }}>
                      <div className="space-y-3">
                        {journey.connections!.map((connection, connIndex) => {
                            // Extract category and number from products (e.g., "IR 15" -> category: "IR", number: "15")
                            const productName = connection.products[0] || '';
                            const categoryMatch = productName.match(/^([A-Z]+)/);
                            const numberMatch = productName.match(/(\d+)/);
                            const category = categoryMatch ? categoryMatch[1] : 'TRAIN';
                            const number = numberMatch ? numberMatch[1] : '';

                            return (
                              <div key={connIndex} className="flex items-center gap-3 py-2">
                                {/* Train Badge */}
                                <TrainBadge category={category} number={number} />

                                {/* Departure Time */}
                                <span className="text-base font-semibold text-white">
                                  {formatTime(connection.from.departure!)}
                                </span>

                                {/* Aarau Platform Badge */}
                                <PlatformBadge platform={connection.from.prognosis.platform || connection.from.platform} />

                                {/* Arrow + ZH Arrival */}
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-300">→</span>
                                  <span className="text-sm text-gray-300">ZH</span>
                                  <span className="text-sm font-medium text-white">
                                    {connection.to.arrival ? formatTime(connection.to.arrival) : 'Endstation'}
                                  </span>
                                </div>

                                {/* Final Destination */}
                                {connection.finalDestination && (
                                  <span className="text-xs text-gray-400">
                                    (via {connection.finalDestination})
                                  </span>
                                )}

                                {/* Hints - ganz am Ende */}
                                <div className="flex items-center gap-2">
                                  {/* Aarau Platform Change */}
                                  {connection.from.platform && connection.from.prognosis.platform &&
                                   connection.from.platform !== connection.from.prognosis.platform && (
                                    <div className="flex items-center gap-1">
                                      <img
                                        src="/icons/platform-change.svg"
                                        alt="Gleisänderung Aarau"
                                        className="h-5 w-auto"
                                      />
                                      <span className="text-xs text-gray-300">Gleisänderung</span>
                                    </div>
                                  )}

                                  {/* Delay */}
                                  <span className={`text-sm font-semibold ${getDelayColor(connection.from.delay || 0)}`}>
                                    {getDelayText(connection.from.delay || 0)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Train Map Modal */}
      {selectedJourney && (
        <TrainMapModal
          journey={selectedJourney}
          onClose={() => setSelectedJourney(null)}
        />
      )}
    </div>
  );
}
