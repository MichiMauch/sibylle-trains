interface StopWithCoordinates {
  station: {
    name: string | null;
    coordinate: {
      x: number | null;
      y: number | null;
    };
  };
  arrival: string | null;
  departure: string | null;
}

export interface TrainPosition {
  lat: number;
  lon: number;
  progress: number; // 0 to 1 between current and next stop
  currentStop: string;
  nextStop: string;
  isMoving: boolean;
}

/**
 * Calculate the current position of a train based on its schedule
 * Uses linear interpolation between the last and next station
 */
export function calculateTrainPosition(
  passList: StopWithCoordinates[],
  currentTime: Date = new Date()
): TrainPosition | null {
  const now = currentTime.getTime();

  // Filter out stops without coordinates
  const stopsWithCoords = passList.filter(
    stop => stop.station.coordinate.x !== null && stop.station.coordinate.y !== null
  );

  if (stopsWithCoords.length < 2) {
    return null;
  }

  // Find the current segment (between two stops)
  for (let i = 0; i < stopsWithCoords.length - 1; i++) {
    const currentStop = stopsWithCoords[i];
    const nextStop = stopsWithCoords[i + 1];

    const departureTime = currentStop.departure ? new Date(currentStop.departure).getTime() : null;
    const arrivalTime = nextStop.arrival ? new Date(nextStop.arrival).getTime() : null;

    if (!departureTime || !arrivalTime) continue;

    // Add a small buffer to handle same-time arrivals/departures
    const arrivalTimeWithBuffer = arrivalTime + 60000; // +1 minute buffer

    // Check if we're currently between these two stops
    if (now >= departureTime && now <= arrivalTimeWithBuffer) {
      const totalDuration = arrivalTime - departureTime;
      const elapsed = now - departureTime;
      const progress = totalDuration > 0 ? Math.min(elapsed / totalDuration, 1) : 0;

      // Linear interpolation between coordinates
      const lat1 = currentStop.station.coordinate.x!;
      const lon1 = currentStop.station.coordinate.y!;
      const lat2 = nextStop.station.coordinate.x!;
      const lon2 = nextStop.station.coordinate.y!;

      const lat = lat1 + (lat2 - lat1) * progress;
      const lon = lon1 + (lon2 - lon1) * progress;

      return {
        lat,
        lon,
        progress,
        currentStop: currentStop.station.name || 'Unknown',
        nextStop: nextStop.station.name || 'Unknown',
        isMoving: true,
      };
    }
  }

  // No segment found - determine train state based on first/last stops
  const firstStop = stopsWithCoords[0];
  const lastStop = stopsWithCoords[stopsWithCoords.length - 1];
  const firstDeparture = firstStop.departure ? new Date(firstStop.departure).getTime() : null;
  const lastArrival = lastStop.arrival ? new Date(lastStop.arrival).getTime() : null;

  // Train hasn't started yet - show at first station, not moving
  if (firstDeparture && now < firstDeparture) {
    return {
      lat: firstStop.station.coordinate.x!,
      lon: firstStop.station.coordinate.y!,
      progress: 0,
      currentStop: firstStop.station.name || 'Unknown',
      nextStop: stopsWithCoords[1]?.station.name || 'Unknown',
      isMoving: false,
    };
  }

  // Train has arrived at final destination
  if (lastArrival && now > lastArrival) {
    return {
      lat: lastStop.station.coordinate.x!,
      lon: lastStop.station.coordinate.y!,
      progress: 1,
      currentStop: lastStop.station.name || 'Unknown',
      nextStop: lastStop.station.name || 'Unknown',
      isMoving: false,
    };
  }

  // Train has departed but no segment matched (edge case) - show at first stop moving to second
  if (stopsWithCoords.length >= 2) {
    return {
      lat: firstStop.station.coordinate.x!,
      lon: firstStop.station.coordinate.y!,
      progress: 0,
      currentStop: firstStop.station.name || 'Unknown',
      nextStop: stopsWithCoords[1].station.name || 'Unknown',
      isMoving: true,
    };
  }

  // Fallback - single stop, show as stationary
  return {
    lat: firstStop.station.coordinate.x!,
    lon: firstStop.station.coordinate.y!,
    progress: 0,
    currentStop: firstStop.station.name || 'Unknown',
    nextStop: firstStop.station.name || 'Unknown',
    isMoving: false,
  };
}

/**
 * Check if a train is currently running (between departure and arrival)
 */
export function isTrainRunning(
  passList: StopWithCoordinates[],
  currentTime: Date = new Date()
): boolean {
  const now = currentTime.getTime();

  const stopsWithTimes = passList.filter(
    stop => stop.departure || stop.arrival
  );

  if (stopsWithTimes.length === 0) return false;

  const firstDeparture = stopsWithTimes[0].departure;
  const lastArrival = stopsWithTimes[stopsWithTimes.length - 1].arrival;

  if (!firstDeparture) return false;

  const startTime = new Date(firstDeparture).getTime();
  const endTime = lastArrival ? new Date(lastArrival).getTime() : startTime + 3600000; // 1 hour default

  return now >= startTime && now <= endTime;
}
