import { formatTime, getDelayColor, getDelayText } from '@/utils/trainUtils';
import type { Connection } from '@/types/transport';
import TrainBadge from '../TrainBadge';
import PlatformBadge from '../PlatformBadge';

interface ConnectionItemProps {
  connection: Connection;
  index: number;
}

export default function ConnectionItem({ connection, index }: ConnectionItemProps) {
  // Extract train category and number from products
  const productName = connection.products[0] || '';
  const categoryMatch = productName.match(/^([A-Z]+)/);
  const numberMatch = productName.match(/(\d+)/);
  const category = categoryMatch ? categoryMatch[1] : 'TRAIN';
  const number = numberMatch ? numberMatch[1] : '';

  return (
    <div key={index} className="bg-gray-800 bg-opacity-30 rounded p-3">
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
}
