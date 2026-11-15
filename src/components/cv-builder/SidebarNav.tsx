import { Layers, Palette, FileText, Sparkles } from 'lucide-react';

export type SidebarTab = 'blocs' | 'design' | 'resume' | 'ia';

interface SidebarNavProps {
  activeTab: SidebarTab | null;
  onTabChange: (tab: SidebarTab | null) => void;
  layout?: 'vertical' | 'horizontal';
}

const TABS: Array<{
  id: SidebarTab;
  icon: React.ElementType;
  label: string;
  activeColor: string;
  activeBg: string;
}> = [
  { id: 'blocs',  icon: Layers,   label: 'Blocs',  activeColor: 'text-lagon-600',   activeBg: 'bg-lagon-50 dark:bg-lagon-900/30'   },
  { id: 'design', icon: Palette,  label: 'Design', activeColor: 'text-lagon-600', activeBg: 'bg-lagon-50 dark:bg-lagon-900/30' },
  { id: 'resume', icon: FileText, label: 'Résumé', activeColor: 'text-green-600',  activeBg: 'bg-green-50 dark:bg-green-900/30'  },
  { id: 'ia',     icon: Sparkles, label: 'IA',     activeColor: 'text-amber-500',  activeBg: 'bg-amber-50 dark:bg-amber-900/30'  },
];

export function SidebarNav({ activeTab, onTabChange, layout = 'vertical' }: SidebarNavProps) {
  const handleClick = (id: SidebarTab) => {
    // En mode vertical (desktop), on peut toggle. En horizontal (mobile), on force toujours un panel ouvert
    if (layout === 'vertical') {
      onTabChange(activeTab === id ? null : id);
    } else {
      onTabChange(id);
    }
  };

  const isHorizontal = layout === 'horizontal';

  return (
    <div className={`flex bg-white dark:bg-[var(--pc-card)] border-gray-200 dark:border-[var(--pc-border)] flex-shrink-0 print:hidden ${
      isHorizontal
        ? 'flex-row items-center justify-around py-1 border-t w-full h-[60px]'
        : 'flex-col items-center py-2 gap-0.5 border-r w-14 h-full'
    }`}>
      {TABS.map(({ id, icon: Icon, label, activeColor, activeBg }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => handleClick(id)}
            title={label}
            className={`
              flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg
              transition-all duration-150 cursor-pointer
              ${isHorizontal ? 'flex-1 max-w-[80px]' : 'w-full'}
              ${isActive
                ? `${activeBg} ${activeColor}`
                : 'text-gray-400 dark:text-[var(--pc-muted)] hover:text-gray-600 dark:hover:text-[var(--pc-text)] hover:bg-gray-50 dark:hover:bg-[var(--pc-hover)]/50'
              }
            `}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span className="text-[9px] font-semibold leading-none tracking-wide">
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
