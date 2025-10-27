import { formatTime, getDelayColor, getDelayText } from '@/utils/trainUtils';
import type { JourneyWithConnection } from '@/hooks/useTrainData';
import TrainBadge from '../TrainBadge';
import PlatformBadge from '../PlatformBadge';

interface TrainDepartureInfoProps {
  journey: JourneyWithConnection;
}

export default function TrainDepartureInfo({ journey }: TrainDepartureInfoProps) {
  return (
    <>
      {/* Departure Time & Minutes Until */}
      <div className="flex items-baseline justify-between mb-4">
        <div className="text-5xl font-bold text-white">
          {formatTime(journey.stop.departure)}
        </div>
        <div className="text-xl font-medium text-gray-300">
          Abfahrt
        </div>
      </div>

      {/* Train Badge & Platform */}
      <div className="flex items-center justify-between mb-4">
        <TrainBadge category={journey.category} number={journey.number} />
        <div className="flex items-center gap-2">
          <span className="text-white text-sm">Gleis</span>
          <PlatformBadge platform={journey.stop.prognosis.platform || journey.stop.platform} />
        </div>
      </div>

      {/* Destination */}
      <div className="text-lg text-gray-300 mb-4">
        Richtung {journey.to}
      </div>

      {/* Delay & Platform Change */}
      <div className="flex items-center gap-4 mb-6">
        <span className={`text-lg font-semibold ${getDelayColor(journey.stop.delay)}`}>
          {getDelayText(journey.stop.delay)}
        </span>
        {journey.stop.platform && journey.stop.prognosis.platform &&
         journey.stop.platform !== journey.stop.prognosis.platform && (
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
    </>
  );
}
