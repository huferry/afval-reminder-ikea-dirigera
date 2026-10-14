'use strict';

const { patchDevice, findLightByRoomAndName, getDevice } = require('./dirigera');
const { loadConfig } = require('./config');

// In-memory notification state
let activeNotification = null;

// Color definitions per waste type
const COLORS = {
  pmd: { hue: 30, saturation: 100, label: 'PMD', colorName: 'orange' },
  papier: { hue: 240, saturation: 100, label: 'Papier', colorName: 'blue' },
  gft: { hue: 120, saturation: 100, label: 'GFT', colorName: 'green' },
  other: { hue: 60, saturation: 80, label: 'Overig', colorName: 'yellow' },
};

function getLightCapabilities(device) {
  const attrs = device.attributes || {};
  const capabilities = {
    isRgb: false,
    hasColorTemp: false,
    hasOnOff: true,
  };

  // Check for color (RGB/hue) support
  if (attrs.colorMode !== undefined || attrs.colorHue !== undefined || attrs.colorSaturation !== undefined) {
    capabilities.isRgb = true;
  }

  // Check for color temperature
  if (attrs.colorTemperature !== undefined || attrs.colorTemperatureMin !== undefined) {
    capabilities.hasColorTemp = true;
  }

  return capabilities;
}

async function activateNotification(wasteType, testMode = false) {
  const config = await loadConfig();

  if (!config.hubUrl || !config.token) {
    throw new Error('Hub not configured. Please complete setup first.');
  }
  if (!config.lightId && (!config.roomName || !config.lightName)) {
    throw new Error('Light not configured. Please complete setup first.');
  }

  let lightId = config.lightId;

  // If we don't have a cached ID, look it up
  if (!lightId) {
    const light = await findLightByRoomAndName(config.hubUrl, config.token, config.roomName, config.lightName);
    if (!light) {
      throw new Error(`Light "${config.lightName}" in room "${config.roomName}" not found on hub.`);
    }
    lightId = light.id;
  }

  // Get current device state to determine capabilities
  const device = await getDevice(config.hubUrl, config.token, lightId);
  const caps = getLightCapabilities(device);
  const color = COLORS[wasteType] || COLORS.other;

  // Build attributes to set
  const attributes = { isOn: true };

  if (caps.isRgb) {
    // Set hue + saturation for RGB lights
    attributes.colorHue = color.hue;
    attributes.colorSaturation = color.saturation;
    // Also set lightLevel to a reasonable brightness
    attributes.lightLevel = 80;
  } else if (caps.hasColorTemp) {
    // Map waste type to color temperature
    const attrs = device.attributes || {};
    const minTemp = attrs.colorTemperatureMin || 2200;
    const maxTemp = attrs.colorTemperatureMax || 6500;
    const midTemp = Math.round((minTemp + maxTemp) / 2);

    if (wasteType === 'pmd') {
      attributes.colorTemperature = minTemp; // warmest = orange-ish
    } else if (wasteType === 'papier') {
      attributes.colorTemperature = maxTemp; // coolest = blue-ish
    } else {
      attributes.colorTemperature = midTemp; // middle = neutral
    }
    attributes.lightLevel = 80;
  } else {
    // Just turn on
    attributes.lightLevel = 80;
  }

  await patchDevice(config.hubUrl, config.token, lightId, attributes);

  activeNotification = {
    wasteType,
    color: color.colorName,
    lightId,
    activatedAt: new Date().toISOString(),
    testMode,
  };

  return activeNotification;
}

async function dismissNotification() {
  const config = await loadConfig();

  if (!activeNotification) {
    return { dismissed: false, reason: 'No active notification' };
  }

  const lightId = activeNotification.lightId || config.lightId;

  if (lightId && config.hubUrl && config.token) {
    try {
      // Turn the light off on dismiss
      await patchDevice(config.hubUrl, config.token, lightId, { isOn: false });
    } catch (err) {
      console.error('Error turning off light on dismiss:', err.message);
    }
  }

  const dismissed = { ...activeNotification };
  activeNotification = null;
  return { dismissed: true, notification: dismissed };
}

function getActiveNotification() {
  return activeNotification;
}

module.exports = { activateNotification, dismissNotification, getActiveNotification, COLORS };
