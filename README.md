# Afval Reminder — IKEA Dirigera

A self-hosted web app that reminds you to put out the trash by changing the color of an IKEA smart light the evening before collection day.

![Status page showing calendar with colored circles for trash days](https://img.shields.io/badge/stack-Node.js%20%2B%20React-blue)

## What it does

- Fetches your waste collection schedule from [Avalex](https://avalex.nl) (serving Delft, Rijswijk, Wassenaar, Midden-Delfland, Leidschendam-Voorburg and Pijnacker-Nootdorp)
- At **19:00 the evening before** a collection day, it turns on a chosen IKEA Zigbee light:
  - **PMD** (plastic/metal/drink cartons) → orange
  - **Papier** (paper/cardboard) → blue
  - **GFT** (green waste) → green
- The light turns off automatically at **08:00** on collection day, or via the Dismiss button in the app

## Requirements

- Docker + Docker Compose
- An IKEA Dirigera hub on your local network
- One or more IKEA smart lights (RGB, colour temperature, or on/off)
- A postal code and house number served by Avalex

## Quick start

```bash
git clone git@github.com:huferry/afval-reminder-ikea-dirigera.git
cd afval-reminder-ikea-dirigera
docker compose up --build
```

Open **http://localhost:3001** and follow the setup wizard.

## Setup wizard

1. **Discover hub** — the app finds your Dirigera hub at `192.168.2.6:8443`
2. **Pair** — press the action button on the bottom of the hub, then click Pair
3. **Address** — enter your postal code and house number
4. **Choose light** — pick the room and light to use for notifications
5. **Test** — verify each waste type lights up correctly

## Status page

- Monthly calendar with hand-drawn colored circles on collection days
- List of the next 6 upcoming collections
- Active notification banner with a Dismiss button
- **Lamp instelling** panel to change the light and trigger test notifications at any time

## Light colour logic

| Capability | PMD | Papier | GFT |
|---|---|---|---|
| RGB | Orange (hue 30°) | Blue (hue 240°) | Green (hue 120°) |
| Colour temperature | Warmest | Coolest | Middle |
| On/off only | On | On | On |

## Dismissal

The notification (light) is dismissed in two ways:
- **Automatically** at 08:00 on the collection day
- **Manually** via the Dismiss button on the status page, or `DELETE /api/notify/dismiss`

## API

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/status` | Current status, active notification, upcoming schedule |
| `GET` | `/api/schedule` | Full waste collection schedule |
| `POST` | `/api/notify/test` | Trigger a test notification `{ wasteType: "pmd" }` |
| `DELETE` | `/api/notify/dismiss` | Dismiss active notification |
| `GET` | `/api/setup/discover` | Discover Dirigera hub |
| `POST` | `/api/setup/pair` | Start pairing flow |
| `GET` | `/api/setup/pair/status` | Poll pairing status |
| `GET` | `/api/setup/lights` | List lights from hub |
| `POST` | `/api/setup/save` | Save full configuration |
| `PATCH` | `/api/config` | Update light selection only |

## Configuration

Config is stored in `/data/config.json` inside the container (mounted as a Docker volume):

```json
{
  "hubUrl": "https://192.168.2.6:8443",
  "token": "...",
  "postalCode": "2614SL",
  "houseNumber": "158",
  "roomName": "Woonkamer",
  "lightName": "Lamp",
  "lightId": "..."
}
```

## Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express |
| Frontend | React + Vite |
| Scheduling | node-cron (Europe/Amsterdam) |
| Waste data | [wasteprod2api.ximmio.com](https://wasteprod2api.ximmio.com) (Avalex backend) |
| Hub | IKEA Dirigera (OAuth PKCE, self-signed TLS) |
| Container | Docker / Docker Compose |

## Extending to other municipalities

The waste data source is in `src/collectors/avalex.js`. To add a different provider, create a new file in `src/collectors/` that exports `fetchSchedule(postalCode, houseNumber)` returning:

```js
[{ date: 'YYYY-MM-DD', type: 'pmd' | 'papier' | 'gft' | 'rest' | 'other', label: string }]
```
