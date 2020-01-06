import * as process from 'process';
import { AppInsights } from './telemetryReporter';

// tslint:disable-next-line: only-arrow-functions no-floating-promises
(async function() {
  const args = process.argv.slice(2);
  const options = JSON.parse(args[0]);
  const reporter = await AppInsights.create(options);
  process.on('message', event => {
    reporter.sendTelemetryEvent(event.eventName, event.attributes);
  });
})();
