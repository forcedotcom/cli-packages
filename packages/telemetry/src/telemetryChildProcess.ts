import * as process from 'process';
import { TelemetryReporter } from './telemetryReporter';

// tslint:disable-next-line: only-arrow-functions no-floating-promises
(async function() {
  const args = process.argv.slice(2);
  const options = JSON.parse(args[0]);
  const reporter = await TelemetryReporter.create(options);
  process.on('message', telemetry => {
    switch (telemetry.type) {
      case 'event': {
        reporter.sendTelemetryEvent(telemetry.eventName, telemetry.attributes);
        break;
      }
      case 'exception': {
        reporter.sendTelemetryException(telemetry.exception, telemetry.attributes);
        break;
      }
      case 'metric': {
        reporter.sendTelemetryMetric(telemetry.metricName, telemetry.value, telemetry.properties);
        break;
      }
      case 'trace': {
        reporter.sendTelemetryTrace(telemetry.traceMessage, telemetry.properties);
        break;
      }
    }
  });
})();
