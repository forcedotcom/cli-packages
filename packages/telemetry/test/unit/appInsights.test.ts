/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { AppInsights, buildPropertiesAndMeasurements, getCpus, getPlatformVersion } from '../../src/appInsights';
import set = Reflect.set;

describe('AppInsights', () => {
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
    const reporter = await AppInsights.create(options);
    const reporterKey = reporter.appInsightsClient ? reporter.appInsightsClient.config.instrumentationKey : null;
    expect(reporter.appInsightsClient).to.not.be.undefined;
    expect(reporterKey).to.equal(key);
  });

  it('should build base properties', async () => {
    const options = { project, key };
    const reporter = await AppInsights.create(options);
    const actualBaseProps = reporter.appInsightsClient ? reporter.appInsightsClient.commonProperties : {};
    const expectedBaseProps = [
      'common.cpus',
      'common.os',
      'common.platformversion',
      'common.systemmemory',
      'common.usertype',
    ];
    expect(Object.keys(actualBaseProps)).to.deep.equal(expectedBaseProps);
  });

  it('should add common properties', async () => {
    const commonProperties = { foo: 'bar', hello: 'world' };
    const options = { project, key, commonProperties };
    const reporter = await AppInsights.create(options);
    const actualProps = reporter.appInsightsClient ? reporter.appInsightsClient.commonProperties : {};
    expect(actualProps).to.contain(commonProperties);

    const actualPropsCount = Object.keys(actualProps).length;
    const providedPropsCount = Object.keys(commonProperties).length;
    expect(actualPropsCount).to.be.greaterThan(providedPropsCount);
  });

  it('should add context tags', async () => {
    const contextTags = { foo: 'bar', hello: 'world' };
    const options = { project, key, contextTags };
    const reporter = await AppInsights.create(options);
    const actualTags = reporter.appInsightsClient ? reporter.appInsightsClient.context.tags : {};
    expect(actualTags).to.contain(contextTags);

    const actualTagsCount = Object.keys(actualTags).length;
    const providedTagsCount = Object.keys(contextTags).length;
    expect(actualTagsCount).to.be.greaterThan(providedTagsCount);
  });

  it(`should replace GDPR sensitive value with ${AppInsights.GDPR_HIDDEN} for roleInstance by default`, async () => {
    const options = { project, key };
    const reporter = await AppInsights.create(options);
    const actualTags = reporter.appInsightsClient ? reporter.appInsightsClient.context.tags : {};

    expect(actualTags['ai.cloud.roleInstance']).to.equal(AppInsights.GDPR_HIDDEN);
  });

  it(`should replace GDPR sensitive value with ${AppInsights.GDPR_HIDDEN} for provided keys`, async () => {
    const options = { project, key, gdprSensitiveKeys: ['hello'] };
    const reporter = await AppInsights.create(options);
    const actualTags = reporter.appInsightsClient ? reporter.appInsightsClient.context.tags : {};
    expect(actualTags['hello']).to.equal(AppInsights.GDPR_HIDDEN);
  });

  it('should setup app insights client with ai.user.id and ai.session.id tag from options', async () => {
    const options = { project, key, userId: 'test-user-id', sessionId: 'test-session-id' };
    const reporter = await AppInsights.create(options);
    const actualTags = reporter?.appInsightsClient?.context?.tags;
    expect(actualTags?.['ai.user.id']).to.equal('test-user-id');
    expect(actualTags?.['ai.session.id']).to.equal('test-session-id');
  });

  it('should change url when using Asimov key', async () => {
    const options = { project, key: 'AIF-12345' };
    const reporter = await AppInsights.create(options);
    const url = reporter.appInsightsClient ? reporter.appInsightsClient.config.endpointUrl : {};
    expect(url).to.equal('https://vortex.data.microsoft.com/collect/v1');
  });

  it('should separate string attributes from numeric attributes', () => {
    const attributes = { foo: 'bar', baz: 5, key: true };
    const expectedProperties = { foo: 'bar', key: 'true' };
    const expectedMeasurements = { baz: 5 };
    const { properties, measurements } = buildPropertiesAndMeasurements(attributes);
    expect(properties).to.deep.equal(expectedProperties);
    expect(measurements).to.deep.equal(expectedMeasurements);
  });

  it('should send telemetry event', async () => {
    const options = { project, key };
    const reporter = await AppInsights.create(options);
    if (reporter.appInsightsClient) {
      trackStub = sandbox.stub(reporter.appInsightsClient, 'trackEvent').callsFake(() => {});
      flushStub = sandbox.stub(reporter.appInsightsClient, 'flush').callsFake(() => {});
    }
    reporter.sendTelemetryEvent('testEvent');
    expect(trackStub.calledOnce).to.be.true;
    expect(flushStub.calledOnce).to.be.false;
  });

  it('stop telemetry event will fail', async () => {
    const options = { project, key };
    const reporter = await AppInsights.create(options);
    flushStub = sandbox.stub(reporter.appInsightsClient, 'flush').callsFake(() => {
      const error = new Error();
      set(error, 'code', 'ExtraTerrestrialBiologicalEntityFromZetaReticuli');
      throw error;
    });

    expect(() => {
      reporter.stop();
    })
      .to.throw(Error)
      .and.have.property('name', 'Error');
  });

  it('should send telemetry exception', async () => {
    const options = { project, key };
    const reporter = await AppInsights.create(options);
    if (reporter.appInsightsClient) {
      trackStub = sandbox.stub(reporter.appInsightsClient, 'trackException').callsFake(() => {});
      flushStub = sandbox.stub(reporter.appInsightsClient, 'flush').callsFake(() => {});
    }
    reporter.sendTelemetryException(new Error('testException'));
    expect(trackStub.calledOnce).to.be.true;
    expect(flushStub.calledOnce).to.be.false;
  });

  it('should send telemetry trace', async () => {
    const options = { project, key };
    const reporter = await AppInsights.create(options);
    if (reporter.appInsightsClient) {
      trackStub = sandbox.stub(reporter.appInsightsClient, 'trackTrace').callsFake(() => {});
      flushStub = sandbox.stub(reporter.appInsightsClient, 'flush').callsFake(() => {});
    }
    reporter.sendTelemetryTrace('testTrace');
    expect(trackStub.calledOnce).to.be.true;
    expect(flushStub.calledOnce).to.be.false;
  });

  it('should send telemetry metric', async () => {
    const options = { project, key };
    const reporter = await AppInsights.create(options);
    if (reporter.appInsightsClient) {
      trackStub = sandbox.stub(reporter.appInsightsClient, 'trackMetric').callsFake(() => {});
      flushStub = sandbox.stub(reporter.appInsightsClient, 'flush').callsFake(() => {});
    }
    reporter.sendTelemetryMetric('testMetric', 0);
    expect(trackStub.calledOnce).to.be.true;
    expect(flushStub.calledOnce).to.be.false;
  });

  it('should handle missing os.cpus value', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    osStub = sandbox.stub(os, 'cpus').callsFake((() => undefined) as any);
    const actual = getCpus();
    expect(actual).to.equal('');
    expect(osStub.calledOnce).to.be.true;
  });

  it('should handle missing os release value', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    osStub = sandbox.stub(os, 'release').callsFake((() => undefined) as any);
    const actual = getPlatformVersion();
    expect(actual).to.equal('');
    expect(osStub.calledOnce).to.be.true;
  });
});
