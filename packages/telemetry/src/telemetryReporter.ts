import { Logger, Messages, SfdxError } from '@salesforce/core';
import { AsyncCreatable, Env } from '@salesforce/kit';
import * as appInsights from 'applicationinsights';
import {
  EventTelemetry,
  ExceptionTelemetry,
  MetricTelemetry,
  TraceTelemetry
} from 'applicationinsights/out/Declarations/Contracts';
import { ChildProcess, fork } from 'child_process';
import * as os from 'os';
import * as path from 'path';

const MODULE_PATH = path.resolve(path.join(__dirname, './telemetryChildProcess.js'));

const SFDX_DISABLE_INSIGHTS = 'SFDX_DISABLE_INSIGHTS';

type Properties = {
  [key: string]: string;
};

type Measurements = {
  [key: string]: number;
};

type Attributes = {
  [key: string]: string | number | undefined;
};

enum TelemetryMethod {
  EVENT = 'trackEvent',
  EXCEPTION = 'trackException',
  METRIC = 'trackMetric',
  TRACE = 'trackTrace'
}

export interface TelemetryOptions {
  project: string;
  key: string;
  commonProperties?: Properties;
  contextTags?: Properties;
  env?: Env;
}

Messages.importMessagesDirectory(__dirname);

export class TelemetryReporter extends AsyncCreatable<TelemetryOptions> {
  private static ASIMOV_ENDPOINT = 'https://vortex.data.microsoft.com/collect/v1';
  public appInsightsClient: appInsights.TelemetryClient | undefined;
  private options: TelemetryOptions;
  private logger!: Logger;
  private env!: Env;

  constructor(options: TelemetryOptions) {
    super(options);
    this.options = options;
  }

  public async init(): Promise<void> {
    this.logger = await Logger.child('TelemetryReporter');
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
    const { properties, measurements } = buildPropertiesAndMeasurements(attributes);
    this.sendTelemetry(TelemetryMethod.EVENT, name, { name, properties, measurements });
  }

  /**
   * Publishes exception to app insights dashboard
   * @param exception {Error} - exception you want published.
   * @param attributes {Attributes} - map of measurements to publish alongside the exception.
   */
  public sendTelemetryException(exception: Error, attributes: Attributes = {}): void {
    const { properties, measurements } = buildPropertiesAndMeasurements(attributes);
    this.sendTelemetry(TelemetryMethod.EXCEPTION, exception.message, { exception, properties, measurements });
  }

  /**
   * Publishes diagnostic information to app insights dashboard
   * @param message {string} - trace message to sen to app insights.
   * @param properties {Properties} - map of properties to publish alongside the event.
   */
  public sendTelemetryTrace(traceMessage: string, properties?: Properties): void {
    this.sendTelemetry(TelemetryMethod.TRACE, traceMessage, { message: traceMessage, properties });
  }

  /**
   * Publishes metric to app insights dashboard
   * @param name {string} - name of the metric you want published
   * @param value {number} - value of the metric
   * @param properties {Properties} - map of properties to publish alongside the event.
   */
  public sendTelemetryMetric(metricName: string, value: number, properties?: Properties): void {
    this.sendTelemetry(TelemetryMethod.METRIC, metricName, { name: metricName, value, properties });
  }

  private sendTelemetry(
    method: TelemetryMethod,
    message: string,
    data: EventTelemetry | ExceptionTelemetry | MetricTelemetry | TraceTelemetry
  ): void {
    if (!isSfdxTelemetryEnabled(this.env)) return;

    if (this.appInsightsClient) {
      this.logger.debug(`Sending telemetry: ${message}`);
      try {
        switch (method) {
          case TelemetryMethod.EVENT: {
            this.appInsightsClient.trackEvent(data as EventTelemetry);
            break;
          }
          case TelemetryMethod.EXCEPTION: {
            this.appInsightsClient.trackException(data as ExceptionTelemetry);
            break;
          }
          case TelemetryMethod.METRIC: {
            this.appInsightsClient.trackMetric(data as MetricTelemetry);
            break;
          }
          case TelemetryMethod.TRACE: {
            this.appInsightsClient.trackTrace(data as TraceTelemetry);
            break;
          }
        }
        this.appInsightsClient.flush();
      } catch (e) {
        const messages = Messages.loadMessages('@salesforce/telemetry', 'telemetry');
        throw new SfdxError(messages.getMessage('unknownError'), 'unknownError', undefined, undefined, e);
      }
    } else {
      this.logger.warn('Failed to send telemetry data because the appInsightsClient does not exist');
      throw SfdxError.create('@salesforce/telemetry', 'telemetry', 'sendFailed');
    }
  }

  /**
   * Initiates the app insights client
   */
  private createAppInsightsClient(): void {
    logTelemetryStatus(this.env, this.logger);
    if (!isSfdxTelemetryEnabled(this.env)) return;

    this.logger.debug('creating appInsightsClient');

    appInsights
      .setup(this.options.key)
      .setAutoCollectRequests(false)
      .setAutoCollectPerformance(false)
      .setAutoCollectExceptions(false)
      .setAutoCollectDependencies(false)
      .setAutoDependencyCorrelation(false)
      .setAutoCollectConsole(false)
      .setUseDiskRetryCaching(false)
      .setInternalLogging(false, false)
      .start();

    this.appInsightsClient = appInsights.defaultClient;
    this.appInsightsClient.commonProperties = this.buildCommonProperties();
    this.appInsightsClient.context.tags = this.buildContextTags();

    if (isAsimovKey(this.options.key)) {
      this.appInsightsClient.config.endpointUrl = TelemetryReporter.ASIMOV_ENDPOINT;
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
    return Object.assign({}, currentTags, this.options.contextTags);
  }
}

export class SpawnedTelemetryReporter extends AsyncCreatable<TelemetryOptions> {
  public static SFDX_INSIGHTS_TIMEOUT = 'SFDX_INSIGHTS_TIMEOUT';
  public forkedProcess!: ChildProcess;
  private modulePath: string = MODULE_PATH;
  private options: TelemetryOptions;
  private logger!: Logger;
  private env!: Env;

  constructor(options: TelemetryOptions) {
    super(options);
    this.options = options;
  }

  public async init(): Promise<void> {
    this.logger = await Logger.child('SpawnedTelemetry');
    this.env = this.options.env || new Env();
    this.beginLifecycle();
  }

  /**
   * Initializes the module at this.modulePath in a child process.
   */
  public start(): void {
    this.logger.debug('starting child process');
    const args = JSON.stringify(this.options);
    this.forkedProcess = fork(this.modulePath, [args]);
    this.logger.debug(`child process started at PID: ${this.forkedProcess.pid}`);
  }

  /**
   * Immediately kills the child process.
   */
  public stop(): void {
    this.logger.debug('stopping child process');
    this.forkedProcess.kill();
  }

  /**
   * Sends message to child process.
   * @param eventName {string} - name of the event you want published.
   * @param attributes {Attributes} - map of properties to publish alongside the event.
   */
  public sendTelemetryEvent(eventName: string, attributes: Attributes = {}): void {
    if (this.forkedProcess) {
      this.forkedProcess.send({ eventName, attributes });
    }
  }

  /**
   * Sends exceptopm to child process.
   * @param exception {Error} - exception you want published.
   * @param measurements {Measurements} - map of measurements to publish alongside the event.
   */
  public sendTelemetryException(exception: Error, attributes: Attributes = {}): void {
    if (this.forkedProcess) {
      this.forkedProcess.send({ exception, attributes });
    }
  }

  /**
   * Publishes diagnostic information to app insights dashboard
   * @param message {string} - trace message to sen to app insights.
   * @param properties {Properties} - map of properties to publish alongside the event.
   */
  public sendTelemetryTrace(traceMessage: string, properties?: Properties): void {
    if (this.forkedProcess) {
      this.forkedProcess.send({ traceMessage, properties });
    }
  }

  /**
   * Publishes metric to app insights dashboard
   * @param name {string} - name of the metric you want published
   * @param value {number} - value of the metric
   * @param properties {Properties} - map of properties to publish alongside the event.
   */
  public sendTelemetryMetric(metricName: string, value: number, properties?: Properties): void {
    if (this.forkedProcess) {
      this.forkedProcess.send({ metricName, value, properties });
    }
  }

  /**
   * Starts the child process, waits, and then stops the child process.
   */
  private beginLifecycle(): void {
    logTelemetryStatus(this.env, this.logger);
    if (!isSfdxTelemetryEnabled(this.env)) return;

    this.start();
    const insightsTimeout = Number(this.env.getString(SpawnedTelemetryReporter.SFDX_INSIGHTS_TIMEOUT)) || 3000;
    this.logger.debug(`Waiting ${insightsTimeout} ms to stop child process`);
    setTimeout(() => {
      this.stop();
      this.logger.debug('Stopped child process');
    }, insightsTimeout);
  }
}

/**
 * Determine if the telemetry event should be logged.
 * Setting SFDX_DISABLE_INSIGHTS to true will disable insights for errors and diagnostics.
 */
function isSfdxTelemetryEnabled(env: Env): boolean {
  const sfdxDisableInsights = env.getBoolean(SFDX_DISABLE_INSIGHTS);
  const isEnabled = !sfdxDisableInsights;
  return isEnabled;
}

function logTelemetryStatus(env: Env, logger: Logger): void {
  const isEnabled = isSfdxTelemetryEnabled(env);
  logger.debug(`'${SFDX_DISABLE_INSIGHTS}': ${!isEnabled}`);
  if (isEnabled) {
    logger.warn(`Insights logging in enabled. This can be disabled by setting ${SFDX_DISABLE_INSIGHTS}=true`);
  } else {
    logger.warn(`Insights logging in disabled. This can be enabled by setting ${SFDX_DISABLE_INSIGHTS}=false`);
  }
}

export function buildPropertiesAndMeasurements(attributes: Attributes) {
  const properties: Properties = {};
  const measurements: Measurements = {};
  Object.keys(attributes).forEach(key => {
    const value = attributes[key];
    if (typeof value === 'string') {
      properties[key] = value;
    } else if (typeof value === 'number') {
      measurements[key] = value;
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
