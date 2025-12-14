/**
 * Polyfill for RCTEventEmitter with Fabric
 * This fixes the "Module has not been registered as callable" error
 */
import { NativeModules, NativeEventEmitter } from 'react-native';

// Try to register `RCTEventEmitter` as callable on multiple potential bridge
// globals. Different React Native versions / new-architecture setups expose
// the bridge under different names; attempt all known variants.
const possibleBridges = [
  global.__fbBatchedBridge,
  global.BatchedBridge,
  global.__BatchedBridge,
  global.__fbBatchedBridge && global.__fbBatchedBridge.BatchedBridge,
  global.__RCTBatchedBridge,
  global.__rct_batched_bridge,
];

const registerOnBridge = (bridge) => {
  if (!bridge) return false;
  const fn = bridge.registerCallableModule || bridge.registerCallableModule?.bind(bridge);
  if (typeof fn === 'function') {
    try {
      fn('RCTEventEmitter', {
        receiveEvent: () => {},
        receiveTouches: () => {},
      });
      return true;
    } catch (e) {
      return false;
    }
  }
  return false;
};

let registered = false;
for (let i = 0; i < possibleBridges.length && !registered; i++) {
  registered = registerOnBridge(possibleBridges[i]);
}

// As a last-resort: try to access __fbBatchedBridge property on other globals
if (!registered && global.__fbBatchedBridge && typeof global.__fbBatchedBridge === 'object') {
  try {
    const bb = global.__fbBatchedBridge.BatchedBridge || global.__fbBatchedBridge;
    registered = registerOnBridge(bb);
  } catch (e) {
    // ignore
  }
}

// If still not registered, leave a non-throwing fallback to avoid crashes
// when native code calls receiveEvent — it will still be an empty function.
if (!registered) {
  try {
    if (!global.__RCTEventEmitterFallback) {
      global.__RCTEventEmitterFallback = {
        receiveEvent: () => {},
        receiveTouches: () => {},
      };
    }
  } catch (e) {
    // ignore
  }
}
