/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import { Logger, Messages } from '@salesforce/core';
import { AsyncCreatable, Env } from '@salesforce/kit';
import { isBoolean, isNumber, isString, JsonPrimitive } from '@salesforce/ts-types';
import * as appInsights from 'applicationinsights';

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
  gdprSensitiveKeys?: string[];
  userId?: string;
  sessionId?: string;
  waitForConnection?: boolean;
}

Messages.importMessagesDirectory(__dirname);

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
  return !!(key && key.startsWith('AIF-'));
}

export function buildPropertiesAndMeasurements(attributes: Attributes): {
  properties: Properties;
  measurements: Measurements;
} {
  const properties: Properties = {};
  const measurements: Measurements = {};
  Object.keys(attributes).forEach((key) => {
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

/**
 * This is a wrapper around appinsights sdk for convenience.
 *
 * NOTE: THis should not be used directly. Use TelemetryReporter which
 * will check if telemetry is disabled and do GDPR checks.
 */
export class AppInsights extends AsyncCreatable<TelemetryOptions> {
  public static GDPR_HIDDEN = '<GDPR_HIDDEN>';
  public static APP_INSIGHTS_SERVER = 'https://dc.services.visualstudio.com';
  private static ASIMOV_ENDPOINT = 'https://vortex.data.microsoft.com/collect/v1';
  public appInsightsClient!: appInsights.TelemetryClient;
  private options: TelemetryOptions;
  private logger!: Logger;
  private env!: Env;
  private gdprSensitiveKeys: string[] = [];

  public constructor(options: TelemetryOptions) {
    super(options);
    this.options = options;

    this.env = this.options.env || new Env();

    if (this.options.gdprSensitiveKeys) {
      this.gdprSensitiveKeys = this.options.gdprSensitiveKeys;
    } else {
      // By default, cloudRoleInstance if a gdpr sensitive property.
      const keys = new appInsights.Contracts.ContextTagKeys();
      this.gdprSensitiveKeys = [keys.cloudRoleInstance];
    }
  }

  public async init(): Promise<void> {
    this.logger = await Logger.child('AppInsights');
    this.createAppInsightsClient();
  }

  /**
   * Publishes event to app insights dashboard
   *
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
   *
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
   *
   * @param message {string} - trace message to sen to app insights.
   * @param properties {Properties} - map of properties to publish alongside the event.
   */
  public sendTelemetryTrace(traceMessage: string, properties?: Properties): void {
    this.logger.debug(`Sending telemetry: trace ${traceMessage}`);
    this.appInsightsClient.trackTrace({ message: traceMessage, properties });
  }

  /**
   * Publishes metric to app insights dashboard
   *
   * @param name {string} - name of the metric you want published
   * @param value {number} - value of the metric
   * @param properties {Properties} - map of properties to publish alongside the event.
   */
  public sendTelemetryMetric(metricName: string, value: number, properties?: Properties): void {
    this.logger.debug(`Sending telemetry metric: ${metricName}`);
    this.appInsightsClient.trackMetric({ name: metricName, value, properties });
  }

  public start(): void {
    // Start data collection services
    appInsights.start();
  }

  public stop(): void {
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
    if (this.options.userId) {
      this.appInsightsClient.context.tags['ai.user.id'] = this.options.userId;
    }
    if (this.options.sessionId) {
      this.appInsightsClient.context.tags['ai.session.id'] = this.options.sessionId;
    }
  }

  /**
   * Builds the properties to send with every event
   *
   * @return {Properties} map of base properties and properties provided when class was created
   */
  private buildCommonProperties(): Properties {
    const baseProperties: Properties = {
      'common.cpus': getCpus(),
      'common.os': os.platform(),
      'common.platformversion': getPlatformVersion(),
      'common.systemmemory': getSystemMemory(),
      'common.usertype': this.env.getString('SFDX_USER_TYPE') || 'normal',
    };
    return Object.assign(baseProperties, this.options.commonProperties);
  }

  /**
   * Builds the context tags for appInsightsClient
   *
   * @return {Properties} map of tags to add to this.appInsightsClient.context.tags
   */
  private buildContextTags(): Properties {
    const currentTags = this.appInsightsClient ? this.appInsightsClient.context.tags : {};
    const cleanedTags = this.hideGDPRdata(currentTags);
    return Object.assign({}, cleanedTags, this.options.contextTags);
  }
  // filters out non-GDPR compliant tags
  private hideGDPRdata(tags: Properties): Properties {
    this.gdprSensitiveKeys.forEach((key) => {
      tags[key] = AppInsights.GDPR_HIDDEN;
    });
    return tags;
  }
}
