import { Platform } from 'react-native';

export const API_BASE_URL = Platform.select({
    android: 'http://10.0.2.2:3000',
    ios: 'http://192.168.1.125:3000', // Physical device or simulator
    default: 'http://192.168.1.125:3000',
});
