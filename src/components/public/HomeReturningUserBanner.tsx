import React from 'react';
import { useApp } from '../../context/AppContext';
import { ArrowRight, RotateCcw } from 'lucide-react';

export const HomeReturningUserBanner: React.FC = () => {
  const { 
    userRole,
    oneTimeOrders, 
    reorderMeal, 
    setActiveTab 
  } = useApp();

  // ONLY show for authenticated customer users (not for guest visitors)
  if (userRole !== 'customer') {
    return null;
  }

  const latestOrder = oneTimeOrders && oneTimeOrders.length > 0 ? oneTimeOrders[0] : null;

  if (!latestOrder) {
    return null;
  }

  return (
    <div className="bg-[#1C2E24] text-white py-2.5 px-4 border-b border-emerald-900/50">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
        
        {/* Left Status */}
        <div className="flex items-center gap-2">
          <span className="text-sm">👋</span>
          <span className="font-semibold text-stone-200">
            Welcome back, <strong className="text-white font-bold">{latestOrder?.userName || 'Friend'}</strong>
          </span>
          <span className="text-stone-500 hidden sm:inline">•</span>
          <span className="text-stone-300">
            <span>Last meal: {latestOrder?.mealName}.</span>
          </span>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          {latestOrder && (
            <button
              onClick={() => reorderMeal(latestOrder.id)}
              className="px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-stone-950 font-black transition-colors flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reorder</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('todays_menu')}
            className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span>View Menu</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

      </div>
    </div>
  );
};
