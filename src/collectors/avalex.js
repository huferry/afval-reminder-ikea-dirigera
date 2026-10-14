'use strict';

const axios = require('axios');

const COMPANY_CODE = 'f7a74ad1-fdbf-4a43-9f91-44644f4d4222';
const API_BASE = 'https://wasteprod2api.ximmio.com/api';

// Map ximmio pickupTypeText to internal type codes
function mapWasteType(pickupTypeText) {
  if (!pickupTypeText) return 'other';
  switch (pickupTypeText.toUpperCase()) {
    case 'PAPER': return 'papier';
    case 'GREEN': return 'gft';
    case 'PACKAGES': return 'pmd'; // PMD / plastic/metal/drinkpacks
    case 'REST': return 'rest';
    default: return 'other';
  }
}

function getLabelForType(type) {
  const labels = {
    pmd: 'PMD afval',
    papier: 'Papier afval',
    gft: 'GFT afval',
    rest: 'Restafval',
    other: 'Overig afval',
  };
  return labels[type] || 'Afval';
}

async function getUniqueAddressId(postalCode, houseNumber) {
  const cleanPostal = postalCode.replace(/\s/g, '').toUpperCase();
  const res = await axios.post(`${API_BASE}/GetAddress`, {
    companyCode: COMPANY_CODE,
    postCode: cleanPostal,
    houseNumber: parseInt(houseNumber, 10) || houseNumber,
  }, { timeout: 10000 });

  const list = res.data && res.data.dataList;
  if (!list || list.length === 0) {
    throw new Error(`Adres niet gevonden: ${cleanPostal} ${houseNumber}`);
  }
  return list[0].UniqueId;
}

/**
 * Fetch waste collection schedule via ximmio/wasteprod2api (used by avalex.nl)
 * Returns array of { date: 'YYYY-MM-DD', type, label, description }
 */
async function fetchSchedule(postalCode, houseNumber) {
  const uniqueAddressID = await getUniqueAddressId(postalCode, houseNumber);

  const now = new Date();
  const startDate = `${now.getFullYear() - 1}-12-25`;
  const endDate = `${now.getFullYear() + 1}-01-27`;

  const res = await axios.post(`${API_BASE}/GetCalendar`, {
    companyCode: COMPANY_CODE,
    uniqueAddressID,
    startDate,
    endDate,
  }, { timeout: 10000 });

  const list = res.data && res.data.dataList;
  if (!Array.isArray(list)) {
    throw new Error('Unexpected response from ximmio API');
  }

  const entries = [];
  for (const item of list) {
    const type = mapWasteType(item._pickupTypeText);
    const label = getLabelForType(type);
    for (const rawDate of (item.pickupDates || [])) {
      const date = rawDate.split('T')[0];
      entries.push({ date, type, label, description: item._pickupTypeText || '' });
    }
  }

  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchUpcomingSchedule(postalCode, houseNumber) {
  const all = await fetchSchedule(postalCode, houseNumber);
  const now = new Date();
  const limit = new Date(now.getFullYear(), now.getMonth() + 3, 1);
  const todayStr = now.toISOString().split('T')[0];
  const limitStr = limit.toISOString().split('T')[0];
  return all.filter((e) => e.date >= todayStr && e.date < limitStr);
}

module.exports = { fetchSchedule, fetchUpcomingSchedule, mapWasteType, getLabelForType };
