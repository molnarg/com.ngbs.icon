# NGBS iCON – Copilot Instructions

## Project Overview

This is a [Homey](https://homey.app) smart home app (App ID: `com.ngbs.icon`) that integrates
**NGBS iCON** surface heating/cooling controllers. It exposes iCON thermostats as Homey devices,
supporting temperature control, heat/cool mode, eco mode, parental lock, and dew protection alarm.

The app uses the [`ngbs-icon`](https://www.npmjs.com/package/ngbs-icon) npm package to communicate
with the controller over its LAN HTTP API (default port 7992). Because the controller has no
supported mDNS/SSDP discovery, pairing relies on either a manual IP entry or an IPv4 subnet scan.

**Stack:**
- Language: TypeScript (compiled to `.homeybuild/` via `tsc`)
- Runtime: Homey Apps SDK v3 (`homey` package)
- Linter: ESLint with `eslint-config-athom`
- Manifest: `app.json` (generated – edit `.homeycompose/app.json` instead)

## Repository Layout

```
app.ts                         # App entry point (extends Homey.App)
common/
  client.ts                    # Shared EventEmitter for broadcasting state updates across devices
  discovery.ts                 # LAN subnet scanner (getSysId per host, parallel batches of 10)
drivers/thermostat/
  driver.ts                    # ThermostatDriver – pairing flow, 60-second polling loop
  device.ts                    # ThermostatDevice – capability listeners, state sync, settings
  pair/                        # Pairing UI views
  assets/                      # Driver images
.homeycompose/
  app.json                     # Source manifest (merged into app.json by Homey tooling)
  capabilities/                # Custom capability definitions (e.g. eco)
locales/                       # i18n strings
assets/                        # App-level images and icons
```

## Key Concepts

- **State broadcasting** (`common/client.ts`): A single `EventEmitter` (`stateUpdates`) is keyed
  by controller URL. When any device polls or writes, it emits the full `NgbsIconState` so all
  devices on the same controller update simultaneously without extra network calls.
- **Polling**: `ThermostatDriver` polls every 60 seconds. Individual devices also poll on `onInit`.
- **Thermostat mode** (`heat` / `cool` / `off`): Homey has no native "off" for thermostats, so
  "off" is implemented by nudging the target temperature past the hysteresis band so the valve
  closes.
- **Network address**: Stored both in `device.data.url` (legacy) and `settings.address`. On init,
  `settings.address` takes precedence if set, and the setting is back-filled on first run.

## Basic Operations

### Install dependencies
```bash
npm install
```

### Build (TypeScript → `.homeybuild/`)
```bash
npm run build
```

### Lint
```bash
npm run lint
```

### Deploy / run on Homey (requires Homey CLI)
```bash
# Install Homey CLI globally if not present
npm install -g homey

# Run in development mode (streams logs to terminal)
homey app run

# Publish to Homey App Store
homey app publish
```

> The compiled output in `.homeybuild/` is what Homey executes. Always build before deploying.

## Adding a New Capability

1. If it's a custom capability, add a JSON definition under `.homeycompose/capabilities/`.
2. Add it to the driver's `capabilities` array in `.homeycompose/app.json`.
3. Regenerate `app.json`:  `homey app compose` (or edit manually keeping both files in sync).
4. Register a capability listener in `device.ts` → `onInit`.
5. Handle it in `setStatus` to reflect incoming state from `NgbsIconState`.

## Notes

- There are no automated tests in this project.
- The `app.json` file at the root is **generated** – always edit `.homeycompose/app.json`.
- TypeScript strict mode is inherited from `@tsconfig/node16`; `allowJs` is enabled.
