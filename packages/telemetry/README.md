# sfdx-telemetry

This package serves an interface for [Microsoft's Application Insights npm module](https://www.npmjs.com/package/applicationinsights).

## Install

`yarn add @salesforce/telemetry --save`

## Usage

```javascript
import TelemetryReporter from '@salesforce/telemetry';

const REPORTER = await TelemetryReporter.create({ project: 'my-project-name', key: 'my-instrumentation-key' });

REPORTER.sendTelemetryEvent('event-name', { foo: 'bar', executionTime: 0.5912 });
```

## Env Variables

`SFDX_DISABLE_INSIGHTS`: Set to `true` if you want to disable telemetry.
`SFDX_INSIGHTS_TIMEOUT`: Amount of time (in milliseconds) allowed for sending events before the connection is closed.
This timeout is a necessary precaution for when customers have the App Insights IP blocked in their firewall. Defaults to 3000ms.
