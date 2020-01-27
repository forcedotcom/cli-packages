import { Logger, Messages } from '@salesforce/core';
import { AsyncCreatable, Env } from '@salesforce/kit';
import { isBoolean, isNumber, isString, JsonPrimitive } from '@salesforce/ts-types';
import * as appInsights from 'applicationinsights';
import * as os from 'os';

export { TelemetryClient } from 'applicationinsights';

export type Properties = {
  [key: string]: string;
};

export type Measurements = {
  [key: string]: number;
};

export type Attributes = {
  [key: string]: JsonPrimitive | undefined;
};

export interface TelemetryOptions {
  project: string;
  key: string;
  commonProperties?: Properties;
  contextTags?: Properties;
  env?: Env;
}

Messages.importMessagesDirectory(__dirname);

/**
 * This is a wrapper around appinsights sdk for convenience.
 *
 * NOTE: THis should not be used directly. Use TelemetryReporter which
 * will check if telemetry is disabled and do GDPR checks.
 */
export class AppInsights extends AsyncCreatable<TelemetryOptions> {
  public static GDPR_HIDDEN = '<GDPR_HIDDEN>';
  private static ASIMOV_ENDPOINT = 'https://vortex.data.microsoft.com/collect/v1';
  public appInsightsClient!: appInsights.TelemetryClient;
  private options: TelemetryOptions;
  private logger!: Logger;
  private env!: Env;

  constructor(options: TelemetryOptions) {
    super(options);
    this.options = options;
  }

  public async init(): Promise<void> {
    this.logger = await Logger.child('AppInsights');
    this.env = this.options.env || new Env();
    this.createAppInsightsClient();
  }

  /**
   * Publishes event to app insights dashboard
   * @param eventName {string} - name of the event you want published. Will be concatenated with this.options.project
   * @param attributes {Attributes} - map of properties to publish alongside the event.
   */
  public sendTelemetryEvent(eventName: string, attributes: Attributes = {}): void {
    const name = `${this.options.project}/${eventName}`;
    this.logger.debug(`Sending telemetry event: ${name}`);
    const { properties, measurements } = buildPropertiesAndMeasurements(attributes);
    this.appInsightsClient.trackEvent({ name, properties, measurements });
  }

  /**
   * Publishes exception to app insights dashboard
   * @param exception {Error} - exception you want published.
   * @param attributes {Attributes} - map of measurements to publish alongside the exception.
   */
  public sendTelemetryException(exception: Error, attributes: Attributes = {}): void {
    this.logger.debug(`Sending telemetry exception: ${exception.message}`);
    const { properties, measurements } = buildPropertiesAndMeasurements(attributes);
    this.appInsightsClient.trackException({ exception, properties, measurements });
  }

  /**
   * Publishes diagnostic information to app insights dashboard
   * @param message {string} - trace message to sen to app insights.
   * @param properties {Properties} - map of properties to publish alongside the event.
   */
  public sendTelemetryTrace(traceMessage: string, properties?: Properties): void {
    this.logger.debug(`Sending telemetry: trace ${traceMessage}`);
    this.appInsightsClient.trackTrace({ message: traceMessage, properties });
  }

  /**
   * Publishes metric to app insights dashboard
   * @param name {string} - name of the metric you want published
   * @param value {number} - value of the metric
   * @param properties {Properties} - map of properties to publish alongside the event.
   */
  public sendTelemetryMetric(metricName: string, value: number, properties?: Properties): void {
    this.logger.debug(`Sending telemetry metric: ${metricName}`);
    this.appInsightsClient.trackMetric({ name: metricName, value, properties });
  }

  public start() {
    // Start data collection services
    appInsights.start();
  }

  public stop() {
    this.appInsightsClient.flush();
    appInsights.dispose();
  }

  /**
   * Initiates the app insights client
   */
  private createAppInsightsClient(): void {
    this.logger.debug('creating appInsightsClient');

    appInsights.setup(this.options.key);

    this.appInsightsClient = appInsights.defaultClient;
    this.appInsightsClient.commonProperties = this.buildCommonProperties();
    this.appInsightsClient.context.tags = this.buildContextTags();

    if (isAsimovKey(this.options.key)) {
      this.appInsightsClient.config.endpointUrl = AppInsights.ASIMOV_ENDPOINT;
    }
  }

  /**
   * Builds the properties to send with every event
   * @return {Properties} map of base properites and properties provided when class was created
   */
  private buildCommonProperties(): Properties {
    const baseProperties: Properties = {
      'common.cpus': getCpus(),
      'common.os': os.platform(),
      'common.platformversion': getPlatformVersion(),
      'common.systemmemory': getSystemMemory(),
      'common.usertype': this.env.getString('SFDX_USER_TYPE') || 'normal'
    };
    return Object.assign(baseProperties, this.options.commonProperties);
  }

  /**
   * Builds the context tags for appInsightsClient
   * @return {Properties} map of tags to add to this.appInsightsClient.context.tags
   */
  private buildContextTags(): Properties {
    const currentTags = this.appInsightsClient ? this.appInsightsClient.context.tags : {};
    const cleanedTags = this.hideGDPRdata(currentTags);
    return Object.assign({}, cleanedTags, this.options.contextTags);
  }
  // filters out non-GDPR compliant tags
  private hideGDPRdata(tags: Properties) {
    const keys = new appInsights.Contracts.ContextTagKeys();
    const gdprSensitiveKeys = [keys.cloudRoleInstance];
    gdprSensitiveKeys.forEach(key => {
      tags[key] = AppInsights.GDPR_HIDDEN;
    });
    return tags;
  }
}

export function buildPropertiesAndMeasurements(attributes: Attributes) {
  const properties: Properties = {};
  const measurements: Measurements = {};
  Object.keys(attributes).forEach(key => {
    const value = attributes[key];
    if (isString(value)) {
      properties[key] = value;
    } else if (isNumber(value)) {
      measurements[key] = value;
    } else if (isBoolean(value)) {
      properties[key] = value.toString();
    }
  });
  return { properties, measurements };
}

export function getPlatformVersion(): string {
  return (os.release() || '').replace(/^(\d+)(\.\d+)?(\.\d+)?(.*)/, '$1$2$3');
}

export function getCpus(): string {
  const cpus = os.cpus();
  if (cpus && cpus.length > 0) {
    return `${cpus[0].model}(${cpus.length} x ${cpus[0].speed})`;
  } else {
    return '';
  }
}

function getSystemMemory(): string {
  return `${(os.totalmem() / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function isAsimovKey(key: string): boolean {
  return !!(key && key.indexOf('AIF-') === 0);
}
