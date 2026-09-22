import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.thalimitra.customer',
  appName: 'Thalimitra',
  webDir: 'dist',
  plugins: {
    SystemBars: {
      style: 'DARK',
      initialViewportFitValueHint: 'cover',
    },
  },
};

export default config;
