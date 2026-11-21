import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.stembot.control',
  appName: 'STEMBOT Control',
  webDir: 'dist',
  backgroundColor: '#1A120E',
  android: {
    // No remote content and no cleartext traffic: everything ships inside the app.
    allowMixedContent: false,
  },
};

export default config;
