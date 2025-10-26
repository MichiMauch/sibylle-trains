interface TrainBadgeProps {
  category: string;
  number: string;
}

export default function TrainBadge({ category, number }: TrainBadgeProps) {
  // Convert category and number to icon name
  // e.g., "S" + "11" → "s-11" (black text), "RE" + "5" → "re-5" (black text), "R" + "87" → "r-87-negative", "IR" + "37" → "ir-37"
  const getIconName = (category: string, number: string): string | null => {
    const cat = category.toLowerCase();
    const num = number.trim();

    // Only use icons for categories with numbered routes
    const supportedCategories = ['s', 'ir', 'ic', 're', 'r'];
    if (supportedCategories.includes(cat) && num) {
      // Use negative icons only for R (white icons for white background)
      const negativeCategories = ['r'];
      const suffix = negativeCategories.includes(cat) ? '-negative' : '';
      return `${cat}-${num}${suffix}`;
    }

    return null;
  };

  // Fallback: SBB color scheme for text-based badges
  const getBadgeStyle = (category: string) => {
    switch (category.toUpperCase()) {
      case 'S': // S-Bahn
        return 'bg-green-600 text-white';
      case 'IR': // InterRegio
        return 'bg-red-600 text-white';
      case 'RE': // RegionalExpress
        return 'bg-blue-600 text-white';
      case 'IC': // InterCity
        return 'bg-red-700 text-white';
      case 'EC': // EuroCity
        return 'bg-red-800 text-white';
      case 'ICE': // InterCity Express
        return 'bg-white text-red-600 border-2 border-red-600';
      case 'RB': // RegionalBahn
        return 'bg-blue-500 text-white';
      case 'PE': // Panorama Express
        return 'bg-yellow-600 text-white';
      default:
        return 'bg-gray-600 text-white';
    }
  };

  const iconName = getIconName(category, number);

  // If we have an icon, display it
  if (iconName) {
    const iconPath = `/icons/${iconName}.svg`;
    const cat = category.toLowerCase();
    const needsWhiteBackground = ['s', 're', 'r'].includes(cat);

    return (
      <div className={needsWhiteBackground ? 'bg-white rounded inline-block' : 'inline-block'}>
        <img
          src={iconPath}
          alt={`${category}${number}`}
          className="h-8 w-auto inline-block align-middle rounded"
          onError={(e) => {
            // Fallback to text badge if icon fails to load
            e.currentTarget.style.display = 'none';
            const parent = e.currentTarget.parentElement;
            if (parent) {
              parent.innerHTML = `<span class="inline-flex items-center px-2.5 py-1 rounded text-sm font-bold ${getBadgeStyle(category)}">${category}${number}</span>`;
            }
          }}
        />
      </div>
    );
  }

  // Fallback for categories without icons
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded text-sm font-bold ${getBadgeStyle(category)}`}
    >
      {category}{number}
    </span>
  );
}
