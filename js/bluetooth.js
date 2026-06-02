/* ----------------------------------------------------
   WEBBLUETOOTH MOCK SYNCING MODULE (js/bluetooth.js)
---------------------------------------------------- */

// Simulated paired device metadata
export const BLE_DEVICES = {
  GLUCOMETER: { name: "GlucoLink-BLE", serviceUuid: "0x1808" }, // Standard BLE Glucose Service
  BPMONITOR: { name: "PressureGuard-BLE", serviceUuid: "0x1810" } // Standard BLE Blood Pressure Service
};

/**
 * Simulates a BLE device search, connection, and data extraction workflow.
 * Provides console-like progress updates to the caller before yielding values.
 */
export function simulateBleSync(deviceType, onReadingExtracted, onStatusUpdate) {
  const device = deviceType === "glucometer" ? BLE_DEVICES.GLUCOMETER : BLE_DEVICES.BPMONITOR;
  
  const steps = [
    { text: `Scanning for nearby Bluetooth devices...`, delay: 1000 },
    { text: `Found matching device: ${device.name} [UUID: ${device.serviceUuid}]`, delay: 1200 },
    { text: `Establishing secure GATT connection...`, delay: 1000 },
    { text: `Reading clinical characteristics characteristics...`, delay: 800 },
    { text: `Successfully synced readings. Disconnecting BLE link.`, delay: 800 }
  ];

  let currentStep = 0;

  function runNextStep() {
    if (currentStep < steps.length) {
      const step = steps[currentStep];
      if (onStatusUpdate) onStatusUpdate(step.text);
      currentStep++;
      setTimeout(runNextStep, step.delay);
    } else {
      // Yield randomized, realistic clinical readings
      const results = {};
      
      if (deviceType === "glucometer") {
        // Yield fasting glucose between 90 and 145 mg/dL
        results.glucose = Math.floor(Math.random() * (145 - 90 + 1)) + 90;
      } else {
        // Yield BP between 115/75 and 135/85
        const sys = Math.floor(Math.random() * (135 - 115 + 1)) + 115;
        const dia = Math.floor(Math.random() * (85 - 75 + 1)) + 75;
        results.bp = `${sys}/${dia}`;
      }
      
      if (onReadingExtracted) onReadingExtracted(results);
    }
  }

  runNextStep();
}
