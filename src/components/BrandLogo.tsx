import React from 'react';

interface BrandLogoProps {
  variant?: 'full' | 'symbol';
  className?: string;
  alt?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'full',
  className = '',
  alt = 'VISIBYL Technologies',
}) => {
  if (variant === 'symbol') {
    return (
      <img
        src="/visibyl-symbol.png"
        alt={alt}
        referrerPolicy="no-referrer"
        className={`object-contain select-none ${className}`}
      />
    );
  }

  return (
    <img
      src="/visibyl-logo-full.png"
      alt={alt}
      referrerPolicy="no-referrer"
      className={`object-contain select-none ${className}`}
    />
  );
};
