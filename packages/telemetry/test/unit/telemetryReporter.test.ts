import { Env } from '@salesforce/kit';
import { expect } from 'chai';
import * as cp from 'child_process';
import { describe, it } from 'mocha';
import * as os from 'os';
import * as sinon from 'sinon';
import {
  buildPropertiesAndMeasurements,
  getCpus,
  getPlatformVersion,
  SpawnedTelemetryReporter,
  TelemetryReporter
} from '../../src/telemetryReporter';
import set = Reflect.set;

describe('TelemetryReporter', () => {
  const key = 'foo-bar-123';
  const project = 'force-com-toolbelt';

  let sandbox: sinon.SinonSandbox;
  let trackStub: sinon.SinonStub;
  let flushStub: sinon.SinonStub;
  let osStub: sinon.SinonStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should connect to app insights dashboard', async () => {
    const options = { project, key };
    const reporter = await TelemetryReporter.create(options);
    const reporterKey = reporter.appInsightsClient ? reporter.appInsightsClient.config.instrumentationKey : null;
    expect(reporter.appInsightsClient).to.not.be.undefined;
    expect(reporterKey).to.equal(key);
  });

  it('should build base properties', async () => {
    const options = { project, key };
    const reporter = await TelemetryReporter.create(options);
    const actualBaseProps = reporter.appInsightsClient ? reporter.appInsightsClient.commonProperties : {};
    const expectedBaseProps = [
      'common.cpus',
      'common.os',
      'common.platformversion',
      'common.systemmemory',
      'common.usertype'
    ];
    expect(Object.keys(actualBaseProps)).to.deep.equal(expectedBaseProps);
  });

  it('should add common properties', async () => {
    const commonProperties = { foo: 'bar', hello: 'world' };
    const options = { project, key, commonProperties };
    const reporter = await TelemetryReporter.create(options);
    const actualProps = reporter.appInsightsClient ? reporter.appInsightsClient.commonProperties : {};
    expect(actualProps).to.contain(commonProperties);

    const actualPropsCount = Object.keys(actualProps).length;
    const providedPropsCount = Object.keys(commonProperties).length;
    expect(actualPropsCount).to.be.greaterThan(providedPropsCount);
  });

  it('should add context tags', async () => {
    const contextTags = { foo: 'bar', hello: 'world' };
    const options = { project, key, contextTags };
    const reporter = await TelemetryReporter.create(options);
    const actualTags = reporter.appInsightsClient ? reporter.appInsightsClient.context.tags : {};
    expect(actualTags).to.contain(contextTags);

    const actualTagsCount = Object.keys(actualTags).length;
    const providedTagsCount = Object.keys(contextTags).length;
    expect(actualTagsCount).to.be.greaterThan(providedTagsCount);
  });

  it('should change url when using Asimov key', async () => {
    const options = { project, key: 'AIF-12345' };
    const reporter = await TelemetryReporter.create(options);
    const url = reporter.appInsightsClient ? reporter.appInsightsClient.config.endpointUrl : {};
    expect(url).to.equal('https://vortex.data.microsoft.com/collect/v1');
  });

  it('should separate string attributes from numeric attributes', () => {
    const attributes = { foo: 'bar', baz: 5 };
    const expectedProperties = { foo: 'bar' };
    const expectedMeasurements = { baz: 5 };
    const { properties, measurements } = buildPropertiesAndMeasurements(attributes);
    expect(properties).to.deep.equal(expectedProperties);
    expect(measurements).to.deep.equal(expectedMeasurements);
  });

  it('should handle non existent appInsightsClient when sendTelemetryEvent is called', async () => {
    const options = { project, key };
    const reporter = await TelemetryReporter.create(options);
    delete reporter.appInsightsClient;
    expect(() => reporter.sendTelemetryEvent('testEvent'))
      .to.throw(Error)
      .and.have.property('name', 'sendFailed');
  });

  it('should handle non existent appInsightsClient when sendTelemetryException is called', async () => {
    const options = { project, key };
    const reporter = await TelemetryReporter.create(options);
    delete reporter.appInsightsClient;
    expect(() => reporter.sendTelemetryException(new Error('testException')))
      .to.throw(Error)
      .and.have.property('name', 'sendFailed');
  });

  it('should handle non existent appInsightsClient when sendTelemetryTrace is called', async () => {
    const options = { project, key };
    const reporter = await TelemetryReporter.create(options);
    delete reporter.appInsightsClient;
    expect(() => reporter.sendTelemetryTrace('testTrace'))
      .to.throw(Error)
      .and.have.property('name', 'sendFailed');
  });

  it('should handle non existent appInsightsClient when sendTelemetryMetric is called', async () => {
    const options = { project, key };
    const reporter = await TelemetryReporter.create(options);
    delete reporter.appInsightsClient;
    expect(() => reporter.sendTelemetryMetric('testMetric', 0))
      .to.throw(Error)
      .and.have.property('name', 'sendFailed');
  });

  it('should send telemetry event', async () => {
    const options = { project, key };
    const reporter = await TelemetryReporter.create(options);
    if (reporter.appInsightsClient) {
      trackStub = sandbox.stub(reporter.appInsightsClient, 'trackEvent').callsFake(() => {});
      flushStub = sandbox.stub(reporter.appInsightsClient, 'flush').callsFake(() => {});
    }
    reporter.sendTelemetryEvent('testEvent');
    expect(trackStub.calledOnce).to.be.true;
    expect(flushStub.calledOnce).to.be.true;
  });

  it('send telemetry event will fail unknown', async () => {
    const options = { project, key };
    const reporter = await TelemetryReporter.create(options);
    if (reporter.appInsightsClient) {
      trackStub = sandbox.stub(reporter.appInsightsClient, 'trackEvent').callsFake(() => {});
      flushStub = sandbox.stub(reporter.appInsightsClient, 'flush').callsFake(() => {
        const error = new Error();
        set(error, 'code', 'ExtraTerrestrialBiologicalEntityFromZetaReticuli');
        throw error;
      });
    }
    expect(() => {
      reporter.sendTelemetryEvent('testEvent');
    })
      .to.throw(Error)
      .and.have.property('name', 'unknownError');
  });

  it('should send telemetry exception', async () => {
    const options = { project, key };
    const reporter = await TelemetryReporter.create(options);
    if (reporter.appInsightsClient) {
      trackStub = sandbox.stub(reporter.appInsightsClient, 'trackException').callsFake(() => {});
      flushStub = sandbox.stub(reporter.appInsightsClient, 'flush').callsFake(() => {});
    }
    reporter.sendTelemetryException(new Error('testException'));
    expect(trackStub.calledOnce).to.be.true;
    expect(flushStub.calledOnce).to.be.true;
  });

  it('send telemetry exception will fail unknown', async () => {
    const options = { project, key };
    const reporter = await TelemetryReporter.create(options);
    if (reporter.appInsightsClient) {
      trackStub = sandbox.stub(reporter.appInsightsClient, 'trackException').callsFake(() => {});
      flushStub = sandbox.stub(reporter.appInsightsClient, 'flush').callsFake(() => {
        const error = new Error();
        set(error, 'code', 'ExtraTerrestrialBiologicalEntityFromZetaReticuli');
        throw error;
      });
    }
    expect(() => {
      reporter.sendTelemetryException(new Error('testException'));
    })
      .to.throw(Error)
      .and.have.property('name', 'unknownError');
  });

  it('should send telemetry trace', async () => {
    const options = { project, key };
    const reporter = await TelemetryReporter.create(options);
    if (reporter.appInsightsClient) {
      trackStub = sandbox.stub(reporter.appInsightsClient, 'trackTrace').callsFake(() => {});
      flushStub = sandbox.stub(reporter.appInsightsClient, 'flush').callsFake(() => {});
    }
    reporter.sendTelemetryTrace('testTrace');
    expect(trackStub.calledOnce).to.be.true;
    expect(flushStub.calledOnce).to.be.true;
  });

  it('send telemetry trace will fail unknown', async () => {
    const options = { project, key };
    const reporter = await TelemetryReporter.create(options);
    if (reporter.appInsightsClient) {
      trackStub = sandbox.stub(reporter.appInsightsClient, 'trackTrace').callsFake(() => {});
      flushStub = sandbox.stub(reporter.appInsightsClient, 'flush').callsFake(() => {
        const error = new Error();
        set(error, 'code', 'ExtraTerrestrialBiologicalEntityFromZetaReticuli');
        throw error;
      });
    }
    expect(() => {
      reporter.sendTelemetryTrace('testTrace');
    })
      .to.throw(Error)
      .and.have.property('name', 'unknownError');
  });

  it('should send telemetry metric', async () => {
    const options = { project, key };
    const reporter = await TelemetryReporter.create(options);
    if (reporter.appInsightsClient) {
      trackStub = sandbox.stub(reporter.appInsightsClient, 'trackMetric').callsFake(() => {});
      flushStub = sandbox.stub(reporter.appInsightsClient, 'flush').callsFake(() => {});
    }
    reporter.sendTelemetryMetric('testMetric', 0);
    expect(trackStub.calledOnce).to.be.true;
    expect(flushStub.calledOnce).to.be.true;
  });

  it('send telemetry metric will fail unknown', async () => {
    const options = { project, key };
    const reporter = await TelemetryReporter.create(options);
    if (reporter.appInsightsClient) {
      trackStub = sandbox.stub(reporter.appInsightsClient, 'trackMetric').callsFake(() => {});
      flushStub = sandbox.stub(reporter.appInsightsClient, 'flush').callsFake(() => {
        const error = new Error();
        set(error, 'code', 'ExtraTerrestrialBiologicalEntityFromZetaReticuli');
        throw error;
      });
    }
    expect(() => {
      reporter.sendTelemetryMetric('testMetric', 0);
    })
      .to.throw(Error)
      .and.have.property('name', 'unknownError');
  });

  it('should not create appInsightsClient when insights are disabled', async () => {
    const env = new Env({});
    env.setBoolean('SFDX_DISABLE_INSIGHTS', true);
    const options = { project, key, env };
    const reporter = await TelemetryReporter.create(options);
    expect(reporter.appInsightsClient).to.be.undefined;
  });

  it('should handle missing os.cpus value', () => {
    osStub = sandbox.stub(os, 'cpus').callsFake(() => {});
    const actual = getCpus();
    expect(actual).to.equal('');
    expect(osStub.calledOnce).to.be.true;
  });

  it('should handle missing os release value', () => {
    osStub = sandbox.stub(os, 'release').callsFake(() => {});
    const actual = getPlatformVersion();
    expect(actual).to.equal('');
    expect(osStub.calledOnce).to.be.true;
  });
});

describe('SpawnedTelemetryReporter', () => {
  const key = 'foo-bar-123';
  const project = 'force-com-toolbelt';

  let sandbox: sinon.SinonSandbox;
  let forkedProcessStub: sinon.SinonStub;
  let killStub: sinon.SinonStub;
  let sendStub: sinon.SinonStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should created a forked process', async () => {
    killStub = sandbox.stub().callsFake(() => {});
    forkedProcessStub = sandbox.stub(cp, 'fork').returns({ kill: killStub });
    const options = { project, key };
    const reporter = await SpawnedTelemetryReporter.create(options);
    reporter.start();
    expect(forkedProcessStub.calledTwice).to.be.true;
  });

  it('should kill a forked process after 3 seconds', async () => {
    killStub = sandbox.stub().callsFake(() => {});
    forkedProcessStub = sandbox.stub(cp, 'fork').returns({ kill: killStub });
    const options = { project, key };
    const reporter = await SpawnedTelemetryReporter.create(options);
    expect(reporter).to.not.be.undefined;
    setTimeout(() => {
      expect(killStub.calledOnce).to.be.true;
    }, 3001);
  });

  it('should send a telemetry event', async () => {
    sendStub = sandbox.stub().callsFake(() => {});
    killStub = sandbox.stub().callsFake(() => {});
    forkedProcessStub = sandbox.stub(cp, 'fork').returns({
      send: sendStub,
      kill: killStub
    });
    const options = { project, key };
    const reporter = await SpawnedTelemetryReporter.create(options);
    reporter.sendTelemetryEvent('testName');
    expect(sendStub.calledOnce).to.be.true;
  });

  it('should send a telemetry exception', async () => {
    sendStub = sandbox.stub().callsFake(() => {});
    killStub = sandbox.stub().callsFake(() => {});
    forkedProcessStub = sandbox.stub(cp, 'fork').returns({
      send: sendStub,
      kill: killStub
    });
    const options = { project, key };
    const reporter = await SpawnedTelemetryReporter.create(options);
    reporter.sendTelemetryException(new Error('testException'));
    expect(sendStub.calledOnce).to.be.true;
  });

  it('should send a telemetry trace', async () => {
    sendStub = sandbox.stub().callsFake(() => {});
    killStub = sandbox.stub().callsFake(() => {});
    forkedProcessStub = sandbox.stub(cp, 'fork').returns({
      send: sendStub,
      kill: killStub
    });
    const options = { project, key };
    const reporter = await SpawnedTelemetryReporter.create(options);
    reporter.sendTelemetryTrace('testTrace');
    expect(sendStub.calledOnce).to.be.true;
  });

  it('should send a telemetry metric', async () => {
    sendStub = sandbox.stub().callsFake(() => {});
    killStub = sandbox.stub().callsFake(() => {});
    forkedProcessStub = sandbox.stub(cp, 'fork').returns({
      send: sendStub,
      kill: killStub
    });
    const options = { project, key };
    const reporter = await SpawnedTelemetryReporter.create(options);
    reporter.sendTelemetryMetric('testMetric', 0);
    expect(sendStub.calledOnce).to.be.true;
  });

  it('should not begin lifecycle when insights are disabled', async () => {
    const env = new Env({});
    env.setBoolean('SFDX_DISABLE_INSIGHTS', true);
    const options = { project, key, env };
    const reporter = await SpawnedTelemetryReporter.create(options);
    expect(reporter.forkedProcess).to.be.undefined;
  });
});
