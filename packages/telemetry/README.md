# sfdx-telemetry

This package serves an interface for [Microsoft's Application Insights npm module](https://www.npmjs.com/package/applicationinsights).

## Install

`yarn add @salesforce/telemetry --save`

## Usage

```javascript
import TelemetryReporter from '@salesforce/telemetry';

const REPORTER = new TelemetryReporter('my-project-name', 'my-instrumentation-key');

REPORTER.sendTelemetryEvent('DIAGNOSTIC', { foo: 'bar', executionTime: 0.5912 });
```
