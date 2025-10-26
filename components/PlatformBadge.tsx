import Image from 'next/image';

interface PlatformBadgeProps {
  platform: string | null | undefined;
}

export default function PlatformBadge({ platform }: PlatformBadgeProps) {
  if (!platform) {
    return <span className="text-gray-600">Gleis ?</span>;
  }

  // Handle complex platform numbers like "12/13" or "1/2"
  // For now, use the first number for the pictogram
  const platformNumber = platform.split('/')[0].trim();

  // Check if it's a valid number (tracks go from 0-99)
  const isValidNumber = /^\d{1,2}$/.test(platformNumber);

  if (!isValidNumber) {
    // Fallback to text for non-standard platform numbers
    return <span className="text-gray-600">Gleis {platform}</span>;
  }

  // Path to the SBB pictogram in public folder
  const pictogramPath = `/pictograms/tracks-${platformNumber}-de-large.svg`;

  return (
    <div className="flex items-center gap-1">
      <img
        src={pictogramPath}
        alt={`Gleis ${platform}`}
        className="h-6 w-auto inline-block align-middle"
        loading="lazy"
        onError={(e) => {
          // Fallback to text if image fails to load
          e.currentTarget.style.display = 'none';
          const parent = e.currentTarget.parentElement;
          if (parent) {
            parent.innerHTML = `<span class="text-gray-600">Gleis ${platform}</span>`;
          }
        }}
      />
      {platform.includes('/') && (
        <span className="text-xs text-gray-600">/{platform.split('/')[1].trim()}</span>
      )}
    </div>
  );
}
