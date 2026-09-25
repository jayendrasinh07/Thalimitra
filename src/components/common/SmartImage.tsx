import React, { useState } from 'react';
import { UtensilsCrossed, Leaf } from 'lucide-react';

interface SmartImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  aspectRatio?: 'video' | 'square' | '4/3' | '16/10' | '3/4' | '21/9' | 'auto';
  className?: string;
  containerClassName?: string;
  priority?: boolean;
  fallbackTitle?: string;
}

export const SmartImage: React.FC<SmartImageProps> = ({
  src,
  alt,
  aspectRatio = 'auto',
  className = '',
  containerClassName = '',
  priority = false,
  fallbackTitle = 'Thalimitra Fresh Meal',
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const getAspectClass = () => {
    switch (aspectRatio) {
      case 'video':
        return 'aspect-video';
      case 'square':
        return 'aspect-square';
      case '4/3':
        return 'aspect-[4/3]';
      case '16/10':
        return 'aspect-[16/10]';
      case '3/4':
        return 'aspect-[3/4]';
      case '21/9':
        return 'aspect-[21/9]';
      case 'auto':
      default:
        return '';
    }
  };

  return (
    <div
      className={`relative overflow-hidden bg-stone-100 ${getAspectClass()} ${containerClassName}`}
    >
      {/* Loading Skeleton */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 bg-gradient-to-r from-stone-200 via-stone-100 to-stone-200 animate-pulse flex items-center justify-center">
          <div className="flex flex-col items-center gap-1.5 opacity-40">
            <UtensilsCrossed className="w-5 h-5 text-stone-500 animate-bounce" />
            <span className="text-[10px] font-bold tracking-wider uppercase text-stone-600">Thalimitra</span>
          </div>
        </div>
      )}

      {/* Error Fallback */}
      {hasError ? (
        <div className="w-full h-full min-h-[140px] flex flex-col items-center justify-center p-4 bg-gradient-to-br from-stone-100 via-amber-50/40 to-emerald-50/50 text-stone-600 select-none">
          <div className="w-10 h-10 rounded-2xl bg-white border border-stone-200 shadow-sm flex items-center justify-center text-[#107048] mb-2">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-stone-800 tracking-tight text-center">
            {fallbackTitle}
          </p>
          <div className="flex items-center gap-1 mt-1 text-[10px] text-[#107048] font-semibold">
            <Leaf className="w-3 h-3" />
            <span>Khana jo roz apna lage.</span>
          </div>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isLoading ? 'opacity-0 scale-105' : 'opacity-100 scale-100'
          } ${className}`}
          {...props}
        />
      )}
    </div>
  );
};
