import { getMinutesUntil, formatTimeUntilDeparture, getTimeStatus } from '@/utils/trainUtils';
import type { JourneyWithConnection } from '@/hooks/useTrainData';

interface TrainCountdownCircleProps {
  journey: JourneyWithConnection;
  onNext: () => void;
  onPrevious: () => void;
  currentIndex: number;
  totalCount: number;
  showNavigation?: boolean;
}

export default function TrainCountdownCircle({
  journey,
  onNext,
  onPrevious,
  currentIndex,
  totalCount,
  showNavigation = true
}: TrainCountdownCircleProps) {
  const minutesUntil = getMinutesUntil(journey.stop.departure);
  const timeStatus = getTimeStatus(minutesUntil);

  return (
    <div className="flex flex-col items-center mb-6 pb-6 border-b border-gray-600">
      {/* Circle with Minutes and Arrow Buttons */}
      <div className="relative w-full flex justify-center">
        {/* Left Arrow - Previous Train */}
        {showNavigation && totalCount > 1 && (
          <button
            onClick={onPrevious}
            className="absolute left-0 top-1/2 transform -translate-y-1/2 transition-all active:scale-95"
            title="Vorheriger Zug"
          >
            <img
              src="/pictograms/arrow-pointing-left-green.svg"
              alt="Zurück"
              className="w-6 h-6"
            />
          </button>
        )}

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
            {formatTimeUntilDeparture(minutesUntil)}
          </div>
        </div>

        {/* Right Arrow - Next Train */}
        {showNavigation && totalCount > 1 && (
          <button
            onClick={onNext}
            className="absolute right-0 top-1/2 transform -translate-y-1/2 transition-all active:scale-95"
            title="Nächster Zug"
          >
            <img
              src="/pictograms/arrow-pointing-right-green.svg"
              alt="Weiter"
              className="w-6 h-6"
            />
          </button>
        )}
      </div>

      {/* Status Text */}
      <div className="text-lg font-medium text-white mt-4 text-center">
        {timeStatus.text}
      </div>

      {/* Navigation Indicator */}
      {showNavigation && totalCount > 1 && (
        <div className="text-xs text-gray-400 mt-2">
          Zug {currentIndex + 1} von {totalCount}
        </div>
      )}
    </div>
  );
}
