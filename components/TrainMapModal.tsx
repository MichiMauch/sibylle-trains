'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Journey } from '@/types/transport';
import { calculateTrainPosition } from '@/utils/trainPosition';

// Fix Leaflet default marker icons in Next.js
import 'leaflet/dist/leaflet.css';

// Custom train icon
const trainIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 18c-1.5 0-2-1-2-2V6c0-1 .5-2 2-2h14c1.5 0 2 1 2 2v10c0 1-.5 2-2 2" fill="#dc2626" stroke="white"/>
      <path d="M15 18l-6 0M9 1l6 0M7 12l10 0" stroke="white"/>
      <circle cx="8" cy="16" r="1" fill="white"/>
      <circle cx="16" cy="16" r="1" fill="white"/>
    </svg>
  `),
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

// Station marker icon
const stationIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="8" fill="#3b82f6" stroke="white"/>
    </svg>
  `),
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
});

interface TrainMapModalProps {
  journey: Journey;
  onClose: () => void;
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function TrainMapModal({ journey, onClose }: TrainMapModalProps) {
  const [trainPos, setTrainPos] = useState(calculateTrainPosition(journey.passList || []));
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update train position every second
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      const newPos = calculateTrainPosition(journey.passList || [], now);
      setTrainPos(newPos);
    }, 1000);

    return () => clearInterval(interval);
  }, [journey]);

  // Get all stops with coordinates for the route
  const stopsWithCoords = (journey.passList || []).filter(
    stop => stop.station?.coordinate?.x && stop.station?.coordinate?.y
  );

  // Create polyline points for the route
  const routePoints: [number, number][] = stopsWithCoords.map(stop => [
    stop.station.coordinate.x!,
    stop.station.coordinate.y!,
  ]);

  // Calculate map center (midpoint of route or train position)
  const mapCenter: [number, number] = trainPos
    ? [trainPos.lat, trainPos.lon]
    : stopsWithCoords.length > 0
    ? [
        stopsWithCoords[0].station.coordinate.x!,
        stopsWithCoords[0].station.coordinate.y!,
      ]
    : [47.391361, 8.051284]; // Aarau as fallback

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-red-600 text-white p-4 rounded-t-lg flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">
              {journey.category} {journey.number} → {journey.to}
            </h2>
            <p className="text-sm opacity-90">
              Betreiber: {journey.operator}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-red-700 rounded-full p-2 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Live Status */}
        {trainPos && (
          <div className="bg-gray-100 p-3 border-b">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                {trainPos.isMoving ? (
                  <>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="font-semibold">Unterwegs</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <span className="font-semibold">Steht</span>
                  </>
                )}
              </div>
              <div className="text-gray-600">
                {trainPos.isMoving
                  ? `${trainPos.currentStop} → ${trainPos.nextStop} (${Math.round(trainPos.progress * 100)}%)`
                  : `Station: ${trainPos.currentStop}`}
              </div>
            </div>
          </div>
        )}

        {/* Map */}
        <div className="flex-1 relative">
          <MapContainer
            center={mapCenter}
            zoom={12}
            scrollWheelZoom={true}
            className="h-full w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapUpdater center={mapCenter} />

            {/* Route line */}
            {routePoints.length > 1 && (
              <Polyline
                positions={routePoints}
                color="#dc2626"
                weight={3}
                opacity={0.7}
              />
            )}

            {/* Station markers */}
            {stopsWithCoords.map((stop, index) => (
              <Marker
                key={index}
                position={[stop.station.coordinate.x!, stop.station.coordinate.y!]}
                icon={stationIcon}
              >
                <Popup>
                  <div className="text-sm">
                    <div className="font-bold">{stop.station.name}</div>
                    {stop.arrival && (
                      <div>Ankunft: {new Date(stop.arrival).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}</div>
                    )}
                    {stop.departure && (
                      <div>Abfahrt: {new Date(stop.departure).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}</div>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Live train position */}
            {trainPos && (
              <Marker
                position={[trainPos.lat, trainPos.lon]}
                icon={trainIcon}
              >
                <Popup>
                  <div className="text-sm">
                    <div className="font-bold">
                      {journey.category} {journey.number}
                    </div>
                    <div>Nach: {journey.to}</div>
                    {trainPos.isMoving && (
                      <>
                        <div className="mt-2 text-xs text-gray-600">
                          Aktuell: {trainPos.currentStop}
                        </div>
                        <div className="text-xs text-gray-600">
                          Nächster Halt: {trainPos.nextStop}
                        </div>
                      </>
                    )}
                    <div className="mt-1 text-xs">
                      Verspätung: {journey.stop.delay > 0 ? `+${journey.stop.delay} Min` : 'Pünktlich'}
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
