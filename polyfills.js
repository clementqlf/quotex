/**
 * Polyfill for RCTEventEmitter with Fabric
 * This fixes the "Module has not been registered as callable" error
 */
import { NativeModules, NativeEventEmitter } from 'react-native';

// Register RCTEventEmitter as callable for different RN bridge globals
// Some RN versions expose the bridge under different global names.
const BatchedBridge =
  global.__fbBatchedBridge || global.BatchedBridge || global.__BatchedBridge ||
  (global.__fbBatchedBridge && global.__fbBatchedBridge.BatchedBridge) ||
  null;

if (BatchedBridge && BatchedBridge.registerCallableModule) {
  try {
    BatchedBridge.registerCallableModule('RCTEventEmitter', {
      receiveEvent: () => {},
      receiveTouches: () => {},
    });
  } catch (e) {
    // Swallow errors silently — registration is best-effort
  }
}
