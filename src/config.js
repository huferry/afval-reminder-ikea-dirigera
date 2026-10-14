'use strict';

const fs = require('fs-extra');
const path = require('path');

const CONFIG_PATH = process.env.CONFIG_PATH || '/data/config.json';

async function loadConfig() {
  try {
    await fs.ensureDir(path.dirname(CONFIG_PATH));
    if (await fs.pathExists(CONFIG_PATH)) {
      const data = await fs.readJson(CONFIG_PATH);
      return data;
    }
    return {};
  } catch (err) {
    console.error('Error loading config:', err.message);
    return {};
  }
}

async function saveConfig(config) {
  try {
    await fs.ensureDir(path.dirname(CONFIG_PATH));
    const existing = await loadConfig();
    const merged = { ...existing, ...config };
    await fs.writeJson(CONFIG_PATH, merged, { spaces: 2 });
    return merged;
  } catch (err) {
    console.error('Error saving config:', err.message);
    throw err;
  }
}

module.exports = { loadConfig, saveConfig, CONFIG_PATH };
