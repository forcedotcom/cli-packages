import { expect } from 'chai';
import * as _ from 'lodash';
import { describe, it } from 'mocha';
import TelemetryReporter, { buildPropertiesAndMeasurements } from '../../src/telemetryReporter';

describe('TelemetryReporter', () => {
  const key = 'foo-bar-123';
  const project = 'force-com-toolbelt';

  it('should connect to app insights dashboard', async () => {
    const options = { project, key };
    const reporter = await TelemetryReporter.create(options);
    const reporterKey = _.get(reporter.appInsightsClient, 'config.instrumentationKey');
    expect(reporter.appInsightsClient).to.not.be.undefined;
    expect(reporterKey).to.equal(key);
  });

  it('should build base properties', async () => {
    const options = { project, key };
    const reporter = await TelemetryReporter.create(options);
    const actualBaseProps = _.get(reporter.appInsightsClient, 'commonProperties');
    const expectedBaseProps = [
      'common.cpus',
      'common.os',
      'common.platformversion',
      'common.systemmemory',
      'common.usertype'
    ];
    expect(_.keys(actualBaseProps)).to.deep.equal(expectedBaseProps);
  });

  it('should add common properties', async () => {
    const commonProperties = { foo: 'bar', hello: 'world' };
    const options = { project, key, commonProperties };
    const reporter = await TelemetryReporter.create(options);
    const actualProps = _.get(reporter.appInsightsClient, 'commonProperties');
    expect(actualProps).to.contain(commonProperties);
    expect(_.size(actualProps)).to.be.greaterThan(_.size(commonProperties));
  });

  it('should add context tags', async () => {
    const contextTags = { foo: 'bar', hello: 'world' };
    const options = { project, key, contextTags };
    const reporter = await TelemetryReporter.create(options);
    const actualTags = _.get(reporter.appInsightsClient, 'context.tags');
    expect(actualTags).to.contain(contextTags);
    expect(_.size(actualTags)).to.be.greaterThan(_.size(contextTags));
  });

  it('should change url when using Asimov key', async () => {
    const options = { project, key: 'AIF-12345' };
    const reporter = await TelemetryReporter.create(options);
    const url = _.get(reporter.appInsightsClient, 'config.endpointUrl');
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
});
