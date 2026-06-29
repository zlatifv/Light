import { registerRootComponent } from 'expo';
import { registerBackgroundMessageHandler } from './src/services/fcmService';
import App from './App';

// MUST run before registerRootComponent / any component mounts.
// This is what lets Android wake the JS engine via a headless task when
// a push notification arrives and the app process is fully killed —
// registering this handler inside a component (e.g. useEffect) is too
// late, the OS needs it bound at module-load time.
registerBackgroundMessageHandler();

registerRootComponent(App);
