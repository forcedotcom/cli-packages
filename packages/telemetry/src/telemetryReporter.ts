import { ConfigAggregator, Logger } from '@salesforce/core';
import { AsyncCreatable } from '@salesforce/kit';

import * as os from 'os';
import { AppInsights, Attributes, Properties, TelemetryOptions } from './appInsights';
import { TelemetryClient } from './exported';

const DISABLE_TELEMETRY = 'disableTelemetry';

export { TelemetryOptions, Attributes, Properties, TelemetryClient } from './appInsights';

/**
 * Reports telemetry events to app insights. We do not send if the config 'disableTelemetry' is set.
 */
export class TelemetryReporter extends AsyncCreatable<TelemetryOptions> {
  private options: TelemetryOptions;
  private logger!: Logger;
  private config!: ConfigAggregator;
  private reporter!: AppInsights;

  constructor(options: TelemetryOptions) {
    super(options);
    this.options = options;
  }

  public async init(): Promise<void> {
    this.logger = await Logger.child('TelemetryReporter');
    this.config = await ConfigAggregator.create({});
    this.reporter = await AppInsights.create(this.options);
  }

  /**
   * Starts data collection services. This is for long running processes. Short lived
   * processes can call send*Event directly then finish it by TelemetryReporter.stop().
   */
  public start(): void {
    this.reporter.start();
  }

  /**
   * Immediately flush and dispose of the reporter. This can usually take 1-3 seconds
   * not counting timeouts.
   */
  public stop(): void {
    this.reporter.stop();
  }

  /**
   * Sends message to child process.
   * @param eventName {string} - name of the event you want published.
   * @param attributes {Attributes} - map of properties to publish alongside the event.
   */
  public sendTelemetryEvent(eventName: string, attributes: Attributes = {}): void {
    if (this.isSfdxTelemetryEnabled()) {
      this.reporter.sendTelemetryEvent(eventName, attributes);
    }
  }

  /**
   * Sends exception to child process.
   * @param exception {Error} - exception you want published.
   * @param measurements {Measurements} - map of measurements to publish alongside the event.
   */
  public sendTelemetryException(exception: Error, attributes: Attributes = {}): void {
    if (this.isSfdxTelemetryEnabled()) {
      // Scrub stack for GDPR
      exception.stack =
        exception.stack && exception.stack.replace(new RegExp(os.homedir(), 'g'), AppInsights.GDPR_HIDDEN);
      this.reporter.sendTelemetryException(exception, attributes);
    }
  }

  /**
   * Publishes diagnostic information to app insights dashboard
   * @param message {string} - trace message to sen to app insights.
   * @param properties {Properties} - map of properties to publish alongside the event.
   */
  public sendTelemetryTrace(traceMessage: string, properties?: Properties): void {
    if (this.isSfdxTelemetryEnabled()) {
      this.reporter.sendTelemetryTrace(traceMessage, properties);
    }
  }

  /**
   * Publishes metric to app insights dashboard
   * @param name {string} - name of the metric you want published
   * @param value {number} - value of the metric
   * @param properties {Properties} - map of properties to publish alongside the event.
   */
  public sendTelemetryMetric(metricName: string, value: number, properties?: Properties): void {
    if (this.isSfdxTelemetryEnabled()) {
      this.reporter.sendTelemetryMetric(metricName, value, properties);
    }
  }

  /**
   * Determine if the telemetry event should be logged.
   * Setting the disableTelemetry config var to true will disable insights for errors and diagnostics.
   */
  public isSfdxTelemetryEnabled(): boolean {
    const sfdxDisableInsights = this.config.getPropertyValue(DISABLE_TELEMETRY);
    const isEnabled = !sfdxDisableInsights;
    return isEnabled;
  }

  public logTelemetryStatus(): void {
    const isEnabled = this.isSfdxTelemetryEnabled();
    if (isEnabled) {
      this.logger.warn(
        `Telemetry is enabled. This can be disabled by running sfdx force:config:set ${DISABLE_TELEMETRY}=true`
      );
    } else {
      this.logger.warn(
        `Telemetry is disabled. This can be enabled by running sfdx force:config:set ${DISABLE_TELEMETRY}=false`
      );
    }
  }

  /**
   * Gets the underline telemetry client. This should only be used to set
   * additional options that are not exposed in the init options. This should
   * NOT be used to send events as it will by pass disabled checks.
   */
  public getTelemetryClient(): TelemetryClient {
    return this.reporter.appInsightsClient;
  }
}
