import { ConfigAggregator, Logger } from '@salesforce/core';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { TelemetryReporter } from '../../src/telemetryReporter';
import { AppInsights } from '../../src/appInsights';

describe('TelemetryReporter', () => {
  const key = 'foo-bar-123';
  const project = 'force-com-toolbelt';

  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
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
    sandbox.stub(ConfigAggregator.prototype, 'getPropertyValue').returns(true);
    const options = { project, key };
    const reporter = await TelemetryReporter.create(options);
    const sendStub = sandbox.stub(reporter.getTelemetryClient(), 'trackEvent').callsFake(() => {});

    reporter.sendTelemetryEvent('testName');
    expect(sendStub.calledOnce).to.be.false;
  });

  it('should not send a telemetry exception when disabled', async () => {
    sandbox.stub(ConfigAggregator.prototype, 'getPropertyValue').returns(true);
    const options = { project, key };
    const reporter = await TelemetryReporter.create(options);
    const sendStub = sandbox.stub(reporter.getTelemetryClient(), 'trackException').callsFake(() => {});

    reporter.sendTelemetryException(new Error('testException'));
    expect(sendStub.calledOnce).to.be.false;
  });

  it('should not send a telemetry trace when disabled', async () => {
    sandbox.stub(ConfigAggregator.prototype, 'getPropertyValue').returns(true);
    const options = { project, key };
    const reporter = await TelemetryReporter.create(options);
    const sendStub = sandbox.stub(reporter.getTelemetryClient(), 'trackTrace').callsFake(() => {});

    reporter.sendTelemetryTrace('testTrace');
    expect(sendStub.calledOnce).to.be.false;
  });

  it('should not send a telemetry metric when disabled', async () => {
    sandbox.stub(ConfigAggregator.prototype, 'getPropertyValue').returns(true);
    const options = { project, key };
    const reporter = await TelemetryReporter.create(options);
    const sendStub = sandbox.stub(reporter.getTelemetryClient(), 'trackMetric').callsFake(() => {});

    reporter.sendTelemetryMetric('testMetric', 0);
    expect(sendStub.calledOnce).to.be.false;
  });

  it('should log to enable telemetry metric when disabled', async () => {
    sandbox.stub(ConfigAggregator.prototype, 'getPropertyValue').returns(true);
    const warn = sandbox.stub();
    sandbox.stub(Logger, 'child').resolves({ warn, debug: sandbox.stub() });
    const options = { project, key };
    const reporter = await TelemetryReporter.create(options);

    reporter.logTelemetryStatus();
    expect(warn.calledOnce).to.be.true;
    expect(warn.firstCall.args[0]).to.contain('=false');
  });

  it('should log to disable telemetry metric when enable', async () => {
    const warn = sandbox.stub();
    sandbox.stub(Logger, 'child').resolves({ warn, debug: sandbox.stub() });
    const options = { project, key };
    const reporter = await TelemetryReporter.create(options);

    reporter.logTelemetryStatus();
    expect(warn.calledOnce).to.be.true;
    expect(warn.firstCall.args[0]).to.contain('=true');
  });
});
