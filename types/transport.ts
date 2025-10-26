export interface Coordinate {
  type: string;
  x: number;
  y: number;
}

export interface Station {
  id: string;
  name: string;
  score: number | null;
  coordinate: Coordinate;
  distance: number | null;
}

export interface Prognosis {
  platform: string | null;
  arrival: string | null;
  departure: string | null;
  capacity1st: number | null;
  capacity2nd: number | null;
}

export interface Stop {
  station: Station;
  arrival: string | null;
  arrivalTimestamp: number | null;
  departure: string;
  departureTimestamp: number;
  delay: number;
  platform: string;
  prognosis: Prognosis;
  realtimeAvailability: string | null;
  location: Station;
}

export interface Journey {
  stop: Stop;
  name: string;
  category: string;
  subcategory: string | null;
  categoryCode: string | null;
  number: string;
  operator: string;
  to: string;
  passList: any[];
  capacity1st: number | null;
  capacity2nd: number | null;
}

export interface StationboardResponse {
  station: Station;
  stationboard: Journey[];
}

// Connection types
export interface ConnectionStop {
  station: Station;
  arrival: string | null;
  arrivalTimestamp: number | null;
  departure: string | null;
  departureTimestamp: number | null;
  delay: number | null;
  platform: string | null;
  prognosis: Prognosis;
  realtimeAvailability: string | null;
  location: Station;
}

export interface Section {
  journey: {
    name: string;
    category: string;
    subcategory: string | null;
    categoryCode: string | null;
    number: string;
    operator: string;
    to: string;
    passList: any[];
    capacity1st: number | null;
    capacity2nd: number | null;
  } | null;
  walk: any | null;
  departure: ConnectionStop;
  arrival: ConnectionStop;
}

export interface Connection {
  from: ConnectionStop;
  to: ConnectionStop;
  duration: string;
  transfers: number;
  service: any | null;
  products: string[];
  capacity1st: number | null;
  capacity2nd: number | null;
  sections: Section[];
  finalDestination?: string; // Final destination of the train (e.g., "Basel SBB")
}

export interface ConnectionsResponse {
  connections: Connection[];
  from: Station;
  to: Station;
}
