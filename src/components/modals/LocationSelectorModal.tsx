import React from 'react';
import { Capacitor } from '@capacitor/core';
import { GoogleMapDeliverySelector } from '../location/GoogleMapDeliverySelector';
import { DeliveryAddress } from '../../types';

interface LocationSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAddress?: (addr: DeliveryAddress) => void;
}

export const LocationSelectorModal: React.FC<LocationSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelectAddress
}) => {
  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6 bg-stone-950/60 backdrop-blur-sm animate-in fade-in duration-200 ${Capacitor.isNativePlatform() ? 'native-modal-safe' : ''}`}>
      {/* 
        Modal Container:
        Desktop: Centered modal (~720px-880px wide, ~650px-720px high)
        Mobile: Full-screen height & width
      */}
      <div 
        className="w-full h-full sm:h-[85vh] sm:max-h-[720px] sm:max-w-3xl lg:max-w-4xl bg-white sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        <GoogleMapDeliverySelector
          onClose={onClose}
          onAddressConfirmed={(addr) => {
            if (onSelectAddress) {
              onSelectAddress(addr);
            }
          }}
        />
      </div>
    </div>
  );
};
