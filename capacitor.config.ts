export interface VisibylCapacitorConfig {
  appId: string;
  appName: string;
  webDir: string;
  server: {
    url?: string;
    androidScheme: string;
    iosScheme: string;
  };
  android: {
    backgroundColor: string;
    allowMixedContent: boolean;
  };
  ios: {
    backgroundColor: string;
    contentInset: string;
  };
}

const config: VisibylCapacitorConfig = {
  appId: 'com.visibyltechnologies.operations',
  appName: 'Visibyl Ops',
  webDir: 'dist',
  server: {
    url: 'https://my-management-iota.vercel.app',
    androidScheme: 'https',
    iosScheme: 'https',
  },
  android: {
    backgroundColor: '#0144D8',
    allowMixedContent: false,
  },
  ios: {
    backgroundColor: '#0144D8',
    contentInset: 'automatic',
  },
};

export default config;
