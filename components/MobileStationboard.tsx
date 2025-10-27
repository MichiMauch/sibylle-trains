'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Journey, StationboardResponse, Connection, ConnectionsResponse } from '@/types/transport';
import TrainBadge from './TrainBadge';
import PlatformBadge from './PlatformBadge';
import SbbClock from './SbbClock';

interface JourneyWithConnection extends Journey {
  aarauArrival?: string;
  aarauPlatform?: string | null;
  aarauPrognosisPlatform?: string | null;
  connections?: Connection[];
}

type Direction = 'toZurich' | 'toMuhen';

export default function MobileStationboard() {
  const [data, setData] = useState<StationboardResponse | null>(null);
  const [journeysWithConnections, setJourneysWithConnections] = useState<JourneyWithConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [direction, setDirection] = useState<Direction>('toZurich');
  const fetchingRef = useRef(false);
  const aarauDataCache = useRef<Journey[]>([]);
  const connectionsDataCache = useRef<JourneyWithConnection[]>([]);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  const getAarauStop = (journey: Journey) => {
    const aarauStop = journey.passList?.find(
      (stop: any) => stop.station?.name === 'Aarau'
    );
    return aarauStop || null;
  };

  const fetchConnections = async (arrivalTime: string, destination: string, aarauStationboard: Journey[]): Promise<Connection[]> => {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [direction, fetchConnectionsRoute]);

  useEffect(() => {
    aarauDataCache.current = [];
    connectionsDataCache.current = [];

    fetchStationboard('full');

    const quickRefreshInterval = setInterval(() => {
      fetchStationboard('quick');
    }, 30000);

    const fullRefreshInterval = setInterval(() => {
      fetchStationboard('full');
    }, 180000);

    return () => {
      clearInterval(quickRefreshInterval);
      clearInterval(fullRefreshInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction]);

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

  const getTimeStatus = (minutes: number) => {
    if (minutes < 3) {
      return {
        color: '#DC0018', // SBB Rot
        text: '🚨 Das reicht nicht mehr 🚨',
        textColor: 'white'
      };
    }
    if (minutes < 6) {
      return {
        color: '#FF8C00', // Orange
        text: '🏃‍♂️ Run, Baby, Run 💨',
        textColor: 'white'
      };
    }
    if (minutes < 8) {
      return {
        color: '#F7BA00', // Gelb
        text: '⚡ Jetzt musst du dich aber sputen ⚡',
        textColor: 'black'
      };
    }
    return {
      color: '#2E327B', // SBB Blau
      text: '😌 Das reicht noch locker ✅',
      textColor: 'white'
    };
  };

  const toggleDirection = () => {
    setDirection(prev => prev === 'toZurich' ? 'toMuhen' : 'toZurich');
  };

  // Get next train (first in list)
  const nextJourney = journeysWithConnections[0];

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#2E327B' }}>
        <div className="text-xl text-white">Lade Abfahrtszeiten...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#2E327B' }}>
        <div className="text-xl text-red-400">Fehler: {error}</div>
      </div>
    );
  }

  if (!nextJourney) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#2E327B' }}>
        <div className="text-xl text-white">Keine Züge gefunden</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#2E327B' }}>
      {/* Header */}
      <div className="text-white p-4 border-b border-white" style={{ backgroundColor: '#2E327B' }}>
        <div className="flex items-center justify-between mb-4">
          {/* SBB Clock */}
          <div className="flex-shrink-0">
            <SbbClock size={60} darkBackground={true} fps={30} />
          </div>

          {/* Direction Toggle Button */}
          <button
            onClick={toggleDirection}
            className="flex items-center justify-center w-12 h-12 bg-white rounded-full hover:bg-gray-200 transition-colors"
            title="Richtung wechseln"
          >
            <img
              src="/icons/arrow-change-small.svg"
              alt="Richtung wechseln"
              className="w-7 h-7"
            />
          </button>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold mb-1">
          {direction === 'toZurich'
            ? 'Muhen → Aarau → Zürich HB'
            : 'Zürich HB → Aarau → Muhen'
          }
        </h1>
        <p className="text-sm opacity-90">
          Nächster Zug • {lastUpdate.toLocaleTimeString('de-CH')}
        </p>
      </div>

      {/* Main Train Card */}
      <div className="p-4">
        <div className="bg-white rounded-lg shadow-lg p-6" style={{ backgroundColor: '#1E2270' }}>
          {/* Countdown Circle */}
          {(() => {
            const minutesUntil = getMinutesUntil(nextJourney.stop.departure);
            const timeStatus = getTimeStatus(minutesUntil);
            return (
              <div className="flex flex-col items-center mb-6 pb-6 border-b border-gray-600">
                {/* Circle with Minutes */}
                <div
                  className="flex flex-col items-center justify-center rounded-full transition-colors duration-500"
                  style={{
                    width: '140px',
                    height: '140px',
                    backgroundColor: timeStatus.color
                  }}
                >
                  <div
                    className="text-sm font-medium"
                    style={{ color: timeStatus.textColor }}
                  >
                    noch
                  </div>
                  <div
                    className="text-4xl font-bold"
                    style={{ color: timeStatus.textColor }}
                  >
                    {minutesUntil} Min
                  </div>
                </div>
                {/* Status Text */}
                <div className="text-lg font-medium text-white mt-4 text-center">
                  {timeStatus.text}
                </div>
              </div>
            );
          })()}

          {/* Departure Time & Minutes Until */}
          <div className="flex items-baseline justify-between mb-4">
            <div className="text-5xl font-bold text-white">
              {formatTime(nextJourney.stop.departure)}
            </div>
            <div className="text-xl font-medium text-gray-300">
              Abfahrt
            </div>
          </div>

          {/* Train Badge & Platform */}
          <div className="flex items-center justify-between mb-4">
            <TrainBadge category={nextJourney.category} number={nextJourney.number} />
            <div className="flex items-center gap-2">
              <span className="text-white text-sm">Gleis</span>
              <PlatformBadge platform={nextJourney.stop.prognosis.platform || nextJourney.stop.platform} />
            </div>
          </div>

          {/* Destination */}
          <div className="text-lg text-gray-300 mb-4">
            Richtung {nextJourney.to}
          </div>

          {/* Delay & Platform Change */}
          <div className="flex items-center gap-4 mb-6">
            <span className={`text-lg font-semibold ${getDelayColor(nextJourney.stop.delay)}`}>
              {getDelayText(nextJourney.stop.delay)}
            </span>
            {nextJourney.stop.platform && nextJourney.stop.prognosis.platform &&
             nextJourney.stop.platform !== nextJourney.stop.prognosis.platform && (
              <div className="flex items-center gap-1">
                <img
                  src="/icons/platform-change.svg"
                  alt="Gleisänderung"
                  className="h-5 w-auto"
                />
                <span className="text-sm text-gray-300">Gleisänderung</span>
              </div>
            )}
          </div>

          {/* Aarau Arrival Info */}
          {nextJourney.aarauArrival && (
            <div className="border-t border-gray-600 pt-4 mb-4">
              <div className="text-sm text-gray-400 mb-2">Ankunft in Aarau</div>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-white">
                  {formatTime(nextJourney.aarauArrival)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm">Gleis</span>
                  <PlatformBadge platform={nextJourney.aarauPrognosisPlatform || nextJourney.aarauPlatform} />
                </div>
              </div>
              {nextJourney.aarauPlatform && nextJourney.aarauPrognosisPlatform &&
               nextJourney.aarauPlatform !== nextJourney.aarauPrognosisPlatform && (
                <div className="flex items-center gap-1 mt-2">
                  <img
                    src="/icons/platform-change.svg"
                    alt="Gleisänderung Aarau"
                    className="h-5 w-auto"
                  />
                  <span className="text-xs text-gray-300">Gleisänderung in Aarau</span>
                </div>
              )}
            </div>
          )}

          {/* Connections */}
          {nextJourney.connections && nextJourney.connections.length > 0 && (
            <div className="border-t border-gray-600 pt-4">
              <div className="text-sm text-gray-400 mb-3">
                Anschlussverbindungen in Aarau
              </div>
              <div className="space-y-3">
                {nextJourney.connections.map((connection, connIndex) => {
                  const productName = connection.products[0] || '';
                  const categoryMatch = productName.match(/^([A-Z]+)/);
                  const numberMatch = productName.match(/(\d+)/);
                  const category = categoryMatch ? categoryMatch[1] : 'TRAIN';
                  const number = numberMatch ? numberMatch[1] : '';

                  return (
                    <div key={connIndex} className="bg-gray-800 bg-opacity-30 rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <TrainBadge category={category} number={number} />
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm">Gleis</span>
                          <PlatformBadge platform={connection.from.prognosis.platform || connection.from.platform} />
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-lg font-bold text-white">
                          {formatTime(connection.from.departure!)}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-300">→</span>
                          <span className="text-sm text-gray-300">
                            {connection.to.arrival ? formatTime(connection.to.arrival) : 'Endstation'}
                          </span>
                        </div>
                      </div>

                      {connection.finalDestination && (
                        <div className="text-xs text-gray-400 mt-1">
                          Richtung {connection.finalDestination}
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-2">
                        {connection.from.platform && connection.from.prognosis.platform &&
                         connection.from.platform !== connection.from.prognosis.platform && (
                          <div className="flex items-center gap-1">
                            <img
                              src="/icons/platform-change.svg"
                              alt="Gleisänderung"
                              className="h-4 w-auto"
                            />
                            <span className="text-xs text-gray-300">Gleisänderung</span>
                          </div>
                        )}
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
      </div>
    </div>
  );
}
