/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ConfigAggregator, Logger } from '@salesforce/core';
import axios from 'axios';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { AppInsights } from '../../src/appInsights';
import { TelemetryReporter } from '../../src/telemetryReporter';

describe('TelemetryReporter', () => {
  const key = 'foo-bar-123';
  const project = 'force-com-toolbelt';

  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (TelemetryReporter as any)['config'];
  });

  it('should send a telemetry event', async () => {
    const options = { project, key };
    const reporter = await TelemetryReporter.create(options);
    const sendStub = sandbox.stub(reporter.getTelemetryClient(), 'trackEvent').callsFake(() => {});

    reporter.sendTelemetryEvent('testName');
    expect(sendStub.calledOnce).to.be.true;
  });

  it('should send a telemetry exception', async () => {
    const options = { project, key };
    const reporter = await TelemetryReporter.create(options);
    const sendStub = sandbox.stub(reporter.getTelemetryClient(), 'trackException').callsFake(() => {});

    reporter.sendTelemetryException(new Error('testException'));
    expect(sendStub.calledOnce).to.be.true;
    expect(sendStub.firstCall.args[0].exception.stack).to.contain(AppInsights.GDPR_HIDDEN);
  });

  it('should send a telemetry trace', async () => {
    const options = { project, key };
    const reporter = await TelemetryReporter.create(options);
    const sendStub = sandbox.stub(reporter.getTelemetryClient(), 'trackTrace').callsFake(() => {});

    reporter.sendTelemetryTrace('testTrace');
    expect(sendStub.calledOnce).to.be.true;
  });

  it('should send a telemetry metric', async () => {
    const options = { project, key };
    const reporter = await TelemetryReporter.create(options);
    const sendStub = sandbox.stub(reporter.getTelemetryClient(), 'trackMetric').callsFake(() => {});

    reporter.sendTelemetryMetric('testMetric', 0);
    expect(sendStub.calledOnce).to.be.true;
  });

  it('should not send a telemetry event when disabled', async () => {
    sandbox.stub(ConfigAggregator.prototype, 'getPropertyValue').returns('true');
    const options = { project, key };
    const reporter = await TelemetryReporter.create(options);
    const sendStub = sandbox.stub(reporter.getTelemetryClient(), 'trackEvent').callsFake(() => {});

    reporter.sendTelemetryEvent('testName');
    expect(sendStub.calledOnce).to.be.false;
  });

  it('should not send a telemetry exception when disabled', async () => {
    sandbox.stub(ConfigAggregator.prototype, 'getPropertyValue').returns('true');
    const options = { project, key };
    const reporter = await TelemetryReporter.create(options);
    const sendStub = sandbox.stub(reporter.getTelemetryClient(), 'trackException').callsFake(() => {});

    reporter.sendTelemetryException(new Error('testException'));
    expect(sendStub.calledOnce).to.be.false;
  });

  it('should not send a telemetry trace when disabled', async () => {
    sandbox.stub(ConfigAggregator.prototype, 'getPropertyValue').returns('true');
    const options = { project, key };
    const reporter = await TelemetryReporter.create(options);
    const sendStub = sandbox.stub(reporter.getTelemetryClient(), 'trackTrace').callsFake(() => {});

    reporter.sendTelemetryTrace('testTrace');
    expect(sendStub.calledOnce).to.be.false;
  });

  it('should not send a telemetry metric when disabled', async () => {
    sandbox.stub(ConfigAggregator.prototype, 'getPropertyValue').returns('true');
    const options = { project, key };
    const reporter = await TelemetryReporter.create(options);
    const sendStub = sandbox.stub(reporter.getTelemetryClient(), 'trackMetric').callsFake(() => {});

    reporter.sendTelemetryMetric('testMetric', 0);
    expect(sendStub.calledOnce).to.be.false;
  });

  it('should log to enable telemetry metric when disabled', async () => {
    sandbox.stub(ConfigAggregator.prototype, 'getPropertyValue').returns('true');
    const warn = sandbox.stub();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sandbox.stub(Logger, 'child').resolves({ warn, debug: sandbox.stub() } as any);
    const options = { project, key };
    const reporter = await TelemetryReporter.create(options);

    reporter.logTelemetryStatus();
    expect(warn.calledOnce).to.be.true;
    expect(warn.firstCall.args[0]).to.contain('=false');
  });

  it('should log to disable telemetry metric when enabled', async () => {
    const warn = sandbox.stub();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sandbox.stub(Logger, 'child').resolves({ warn, debug: sandbox.stub() } as any);
    const options = { project, key };
    const reporter = await TelemetryReporter.create(options);

    reporter.logTelemetryStatus();
    expect(warn.calledOnce).to.be.true;
    expect(warn.firstCall.args[0]).to.contain('=true');
  });

  it('should cache config aggregator', async () => {
    const stub = sandbox.stub(ConfigAggregator, 'create');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stub.resolves({ getPropertyValue: () => false } as any);
    expect(await TelemetryReporter.determineSfdxTelemetryEnabled()).to.be.true;

    stub.reset();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stub.resolves({ getPropertyValue: () => true } as any);
    expect(await TelemetryReporter.determineSfdxTelemetryEnabled()).to.be.true;
  });

  it('should test connection to app insights if waitForConnection is true', async () => {
    const testConnection = sandbox.stub(TelemetryReporter.prototype, 'testConnection').callsFake(async () => true);
    const options = { project, key, waitForConnection: true };
    await TelemetryReporter.create(options);
    expect(testConnection.calledOnce).to.be.true;
  });

  it('should throw an error if it cannot conenct to app insights', async () => {
    sandbox.stub(axios, 'get').throws(() => {
      return { code: 'TIMEOUT!' };
    });
    const options = { project, key, waitForConnection: true };
    try {
      await TelemetryReporter.create(options);
    } catch (err) {
      expect(err.message).to.equal('Unable to connect to app insights.');
    }
  });

  it('should get the appInsightsClient', async () => {
    const options = { project, key };
    const reporter = await TelemetryReporter.create(options);
    reporter.start();
    const client = reporter.getTelemetryClient();
    expect(client).to.not.be.undefined;
    reporter.stop();
  });
});
