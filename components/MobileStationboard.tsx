'use client';

import { useEffect } from 'react';
import SbbClock from './SbbClock';
import TrainCountdownCircle from './mobile/TrainCountdownCircle';
import TrainDepartureInfo from './mobile/TrainDepartureInfo';
import AarauArrivalInfo from './mobile/AarauArrivalInfo';
import ConnectionsList from './mobile/ConnectionsList';
import LoadingScreen from './mobile/LoadingScreen';
import { useTrainData, type JourneyWithConnection } from '@/hooks/useTrainData';
import { useTrainNavigation } from '@/hooks/useTrainNavigation';

export default function MobileStationboard() {
  const {
    data,
    journeysWithConnections,
    loading,
    error,
    lastUpdate,
    direction,
    isDirectionChanging,
    toggleDirection
  } = useTrainData();

  const {
    currentIndex,
    previousIndex,
    slideDirection,
    isAnimating,
    handleNextTrain,
    handlePreviousTrain,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    resetIndex
  } = useTrainNavigation(journeysWithConnections.length);

  // Reset current index when direction changes
  useEffect(() => {
    resetIndex();
  }, [direction, resetIndex]);

  // Reset currentIndex when journeys change or if current index is out of bounds
  useEffect(() => {
    if (currentIndex >= journeysWithConnections.length && journeysWithConnections.length > 0) {
      resetIndex();
    }
  }, [journeysWithConnections, currentIndex, resetIndex]);

  const toggleDirectionHandler = () => {
    resetIndex();
    toggleDirection();
  };

  // Get current train based on index
  const nextJourney = journeysWithConnections[currentIndex];

  // Render train card content for a given journey
  const renderTrainCardContent = (journey: JourneyWithConnection, indexForDisplay: number) => {
    const showNavigation = true; // TODO: Change back to: minutesUntil < 6

    return (
      <>
        {/* Countdown Circle */}
        <TrainCountdownCircle
          journey={journey}
          onNext={handleNextTrain}
          onPrevious={handlePreviousTrain}
          currentIndex={indexForDisplay}
          totalCount={journeysWithConnections.length}
          showNavigation={showNavigation}
        />

        {/* Departure Info */}
        <TrainDepartureInfo journey={journey} />

        {/* Aarau Arrival Info */}
        <AarauArrivalInfo
          aarauArrival={journey.aarauArrival}
          aarauPlatform={journey.aarauPlatform}
          aarauPrognosisPlatform={journey.aarauPrognosisPlatform}
        />

        {/* Connections */}
        <ConnectionsList connections={journey.connections} />
      </>
    );
  };

  // Show loading/error states
  const shouldShowLoading = (loading && !data) || isDirectionChanging || !nextJourney;
  const shouldShowNoTrains = !nextJourney && !loading && !isDirectionChanging;

  if (shouldShowLoading || error || shouldShowNoTrains) {
    return <LoadingScreen loading={shouldShowLoading} error={error} hasNoTrains={shouldShowNoTrains} />;
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
            onClick={toggleDirectionHandler}
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
        <div
          className="bg-white rounded shadow-lg p-6 relative overflow-hidden"
          style={{ backgroundColor: '#1E2270' }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Previous card sliding out */}
          {previousIndex !== null && journeysWithConnections[previousIndex] && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                padding: '1.5rem',
                transform: isAnimating
                  ? (slideDirection === 'left' ? 'translateX(-100%)' : 'translateX(100%)')
                  : 'translateX(0)',
                opacity: isAnimating ? 0 : 1,
                transition: isAnimating ? 'transform 300ms ease-out, opacity 300ms ease-out' : 'none',
                pointerEvents: 'none'
              }}
            >
              {renderTrainCardContent(journeysWithConnections[previousIndex], previousIndex)}
            </div>
          )}

          {/* Current card sliding in or static */}
          <div
            style={{
              transform: isAnimating
                ? 'translateX(0)'
                : previousIndex !== null
                  ? (slideDirection === 'left' ? 'translateX(100%)' : 'translateX(-100%)')
                  : 'translateX(0)',
              opacity: isAnimating || previousIndex === null ? 1 : 0,
              transition: isAnimating ? 'transform 300ms ease-out, opacity 300ms ease-out' : 'none'
            }}
          >
            {renderTrainCardContent(nextJourney, currentIndex)}
          </div>
        </div>
      </div>
    </div>
  );
}
