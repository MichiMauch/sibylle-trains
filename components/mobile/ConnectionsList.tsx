import type { Connection } from '@/types/transport';
import ConnectionItem from './ConnectionItem';

interface ConnectionsListProps {
  connections?: Connection[];
}

export default function ConnectionsList({ connections }: ConnectionsListProps) {
  if (!connections || connections.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-gray-600 pt-4">
      <div className="text-sm text-gray-400 mb-3">
        Anschlussverbindungen in Aarau
      </div>
      <div className="space-y-3">
        {connections.map((connection, index) => (
          <ConnectionItem key={index} connection={connection} index={index} />
        ))}
      </div>
    </div>
  );
}
