/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Logger } from '@salesforce/core';
import { testSetup } from '@salesforce/core/lib/testSetup';
import { env } from '@salesforce/kit';
import { Dictionary, Optional } from '@salesforce/ts-types';
import { expect } from 'chai';
import chalk from 'chalk';
import cli from 'cli-ux';
import { UX } from '../../src/ux';

chalk.enabled = false;

// Setup the test environment.
const $$ = testSetup();

describe('UX', () => {
  const sfdxEnv = process.env.SFDX_ENV;
  const argv = process.argv;

  beforeEach(() => {
    process.env.SFDX_ENV = 'test';
  });

  afterEach(() => {
    process.env.SFDX_ENV = sfdxEnv;
    process.argv = argv;
  });

  it('log() should only log to the logger when output IS NOT enabled', () => {
    const info = $$.SANDBOX.stub($$.TEST_LOGGER, 'info');
    const log = $$.SANDBOX.stub(cli, 'log');
    const ux = new UX($$.TEST_LOGGER, false, cli);
    const logMsg = 'test log() 1 for log wrapper';

    const ux1 = ux.log(logMsg);

    expect(info.called).to.equal(true);
    expect(info.firstCall.args[0]).to.equal(logMsg);
    expect(log.called).to.equal(false);
    expect(ux1).to.equal(ux);
  });

  describe('JSON', () => {
    afterEach(() => {
      env.unset('SFDX_CONTENT_TYPE');
    });

    it('log() should not log to stdout when json is set via the process args', () => {
      const info = $$.SANDBOX.stub($$.TEST_LOGGER, 'info');
      const log = $$.SANDBOX.stub(cli, 'log');
      process.argv = ['--json'];
      const ux = new UX($$.TEST_LOGGER, undefined, cli);
      const logMsg = 'test log() 1 for log wrapper';

      const ux1 = ux.log(logMsg);

      expect(info.called).to.equal(true);
      expect(info.firstCall.args[0]).to.equal(logMsg);
      expect(log.called).to.equal(false);
      expect(ux1).to.equal(ux);
    });
    it('log() should not log to stdout when SFDX_CONTENT_TYPE=JSON', () => {
      const info = $$.SANDBOX.stub($$.TEST_LOGGER, 'info');
      const log = $$.SANDBOX.stub(cli, 'log');
      env.setString('SFDX_CONTENT_TYPE', 'jSON');
      const ux = new UX($$.TEST_LOGGER, undefined, cli);
      const logMsg = 'test log() 1 for log wrapper';

      const ux1 = ux.log(logMsg);

      expect(info.called).to.equal(true);
      expect(info.firstCall.args[0]).to.equal(logMsg);
      expect(log.called).to.equal(false);
      expect(ux1).to.equal(ux);
    });
  });

  it('log() should log to the logger and stdout when output IS enabled', () => {
    const info = $$.SANDBOX.stub($$.TEST_LOGGER, 'info');
    const log = $$.SANDBOX.stub(cli, 'log');
    const ux = new UX($$.TEST_LOGGER, true, cli);
    const logMsg = 'test log() 2 for log wrapper';

    const ux1 = ux.log(logMsg);

    expect(info.called).to.equal(true);
    expect(info.firstCall.args[0]).to.equal(logMsg);
    expect(log.called).to.equal(true);
    expect(log.firstCall.args[0]).to.equal(logMsg);
    expect(ux1).to.equal(ux);
  });

  it('logJson() should log to the logger (unformatted) and stdout (formatted)', () => {
    let retVal: Optional<object>;
    const info = $$.SANDBOX.stub($$.TEST_LOGGER, 'info');
    const styledJsonGetter = () => (x: object) => (retVal = x);
    $$.SANDBOX.stub(cli, 'styledJSON').get(styledJsonGetter);
    const ux = new UX($$.TEST_LOGGER, true, cli);
    const logMsg = { key1: 'foo', key2: 9, key3: true, key4: [1, 2, 3] };

    const ux1 = ux.logJson(logMsg);

    expect(info.called).to.equal(true);
    expect(info.firstCall.args[0]).to.equal(logMsg);
    expect(retVal).to.deep.equal(logMsg);
    expect(ux1).to.equal(ux);
  });

  it('errorJson() should log to the logger (logLevel = error) and stderr', () => {
    const loggerError = $$.SANDBOX.stub($$.TEST_LOGGER, 'error');
    const consoleError = $$.SANDBOX.stub(console, 'error');
    const ux = new UX($$.TEST_LOGGER, true, cli);
    const logMsg = { key1: 'foo', key2: 9, key3: true, key4: [1, 2, 3] };

    ux.errorJson(logMsg);

    expect(loggerError.called).to.equal(true);
    expect(loggerError.firstCall.args[0]).to.equal(JSON.stringify(logMsg, null, 4));
    expect(consoleError.called).to.equal(true);
    expect(consoleError.firstCall.args[0]).to.equal(JSON.stringify(logMsg, null, 4));
  });

  it('error() should only log to the logger (logLevel = error) when output IS NOT enabled', () => {
    const loggerError = $$.SANDBOX.stub($$.TEST_LOGGER, 'error');
    const consoleError = $$.SANDBOX.stub(console, 'error');
    const ux = new UX($$.TEST_LOGGER, false, cli);
    const logMsg = 'test error() 1 for log wrapper';

    ux.error(logMsg);

    expect(loggerError.called).to.equal(true);
    expect(loggerError.firstCall.args[0]).to.equal(logMsg);
    expect(consoleError.called).to.equal(false);
  });

  it('error() should log to the logger (logLevel = error) and stderr when output IS enabled', () => {
    const loggerError = $$.SANDBOX.stub($$.TEST_LOGGER, 'error');
    const consoleError = $$.SANDBOX.stub(console, 'error');
    const ux = new UX($$.TEST_LOGGER, true, cli);
    const logMsg = 'test error() 2 for log wrapper\n';

    ux.error(logMsg);

    expect(loggerError.called).to.equal(true);
    expect(loggerError.firstCall.args[0]).to.equal(logMsg);
    expect(consoleError.called).to.equal(true);
    expect(consoleError.firstCall.args[0]).to.equal(logMsg);
  });

  it('styledObject() should only log to the logger when output IS NOT enabled', () => {
    const info = $$.SANDBOX.stub($$.TEST_LOGGER, 'info');
    const styledObject = $$.SANDBOX.stub(cli, 'styledObject');
    const ux = new UX($$.TEST_LOGGER, false, cli);
    const logMsg = { key1: 'foo', key2: 9, key3: true, key4: [1, 2, 3] };

    const ux1 = ux.styledObject(logMsg);

    expect(info.called).to.equal(true);
    expect(info.firstCall.args[0]).to.equal(logMsg);
    expect(styledObject.called).to.equal(false);
    expect(ux1).to.equal(ux);
  });

  it('styledObject() should log to the logger and stdout when output IS enabled', () => {
    const info = $$.SANDBOX.stub($$.TEST_LOGGER, 'info');
    const styledObject = $$.SANDBOX.stub(cli, 'styledObject');
    const ux = new UX($$.TEST_LOGGER, true, cli);
    const logMsg = { key1: 'foo', key2: 9, key3: true, key4: [1, 2, 3] };
    const keysToLog = ['key1', 'key2', 'key3'];

    const ux1 = ux.styledObject(logMsg, keysToLog);

    expect(info.called).to.equal(true);
    expect(info.firstCall.args[0]).to.equal(logMsg);
    expect(styledObject.called).to.equal(true);
    expect(styledObject.firstCall.args[0]).to.equal(logMsg);
    expect(styledObject.firstCall.args[1]).to.equal(keysToLog);
    expect(ux1).to.equal(ux);
  });

  it('styledHeader() should only log to the logger when output IS NOT enabled', () => {
    let retVal: Optional<string>;
    const info = $$.SANDBOX.stub($$.TEST_LOGGER, 'info');
    const styledHeaderGetter = () => (x: string) => (retVal = x);
    $$.SANDBOX.stub(cli, 'styledHeader').get(styledHeaderGetter);
    const ux = new UX($$.TEST_LOGGER, false, cli);
    const logMsg = 'test styledHeader() 1 for log wrapper';

    const ux1 = ux.styledHeader(logMsg);

    expect(info.called).to.equal(true);
    expect(info.firstCall.args[0]).to.equal(logMsg);
    expect(retVal).to.equal(undefined);
    expect(ux1).to.equal(ux);
  });

  it('styledHeader() should log to the logger and stdout when output IS enabled', () => {
    let retVal: Optional<string>;
    const info = $$.SANDBOX.stub($$.TEST_LOGGER, 'info');
    const styledHeaderGetter = () => (x: string) => (retVal = x);
    $$.SANDBOX.stub(cli, 'styledHeader').get(styledHeaderGetter);
    const ux = new UX($$.TEST_LOGGER, true, cli);
    const logMsg = 'test styledHeader() 2 for log wrapper';

    const ux1 = ux.styledHeader(logMsg);

    expect(info.called).to.equal(true);
    expect(info.firstCall.args[0]).to.equal(logMsg);
    expect(retVal).to.equal(logMsg);
    expect(ux1).to.equal(ux);
  });

  it('formatDeprecationWarning should display a consistent msg with minimal config', () => {
    const depConfig = {
      type: 'command',
      name: 'apex:test:qq',
      version: 42,
    };
    const expectedMsg = `The ${depConfig.type} "${depConfig.name}" has been deprecated and will be removed in v${
      depConfig.version + 1
    }.0 or later.`;
    expect(UX.formatDeprecationWarning(depConfig)).to.equal(expectedMsg);
  });

  it('formatDeprecationWarning should display a custom message', () => {
    const depConfig = {
      messageOverride: "Don't do what Donny Dont does.",
      message: 'Do this instead.',
    };
    const expectedMsg = `${depConfig.messageOverride} ${depConfig.message}`;
    expect(UX.formatDeprecationWarning(depConfig)).to.equal(expectedMsg);
  });

  it('formatDeprecationWarning should display a consistent msg with full config and numeric version', () => {
    const depConfig = {
      type: 'command',
      name: 'apex:test:qq',
      version: 42,
      to: 'apex.test.pewpew',
      message: 'Need more pew pew, less qq!',
    };
    let expectedMsg = `The ${depConfig.type} "${depConfig.name}" has been deprecated and will be removed in v${
      depConfig.version + 1
    }.0 or later.`;
    expectedMsg += ` Use "${depConfig.to}" instead. ${depConfig.message}`;
    expect(UX.formatDeprecationWarning(depConfig)).to.equal(expectedMsg);
  });

  it('formatDeprecationWarning should display a consistent msg with full config and string version', () => {
    const version = 42;
    const depConfig = {
      type: 'command',
      name: 'apex:test:qq',
      version: `${version}.0`,
      to: 'apex.test.pewpew',
      message: 'Need more pew pew, less qq!',
    };
    let expectedMsg = `The ${depConfig.type} "${depConfig.name}" has been deprecated and will be removed in v${
      version + 1
    }.0 or later.`;
    expectedMsg += ` Use "${depConfig.to}" instead. ${depConfig.message}`;
    expect(UX.formatDeprecationWarning(depConfig)).to.equal(expectedMsg);
  });

  it('table() should only log to the logger when output IS NOT enabled', () => {
    let retVal: Optional<object>;
    const info = $$.SANDBOX.stub($$.TEST_LOGGER, 'info');
    const tableGetter = () => (x: object) => (retVal = x);
    $$.SANDBOX.stub(cli, 'table').get(tableGetter);
    const ux = new UX($$.TEST_LOGGER, false, cli);
    const tableData = [
      { foo: 'amazing!', bar: 3, baz: true },
      { foo: 'incredible!', bar: 0, baz: false },
      { foo: 'truly amazing!', bar: 9, baz: true },
    ];

    const ux1 = ux.table(tableData);

    expect(info.called).to.equal(true);
    expect(info.firstCall.args[0]).to.equal(tableData);
    expect(retVal).to.equal(undefined);
    expect(ux1).to.equal(ux);
  });

  it('table() should log to the logger and output in table format when output IS enabled with simple column config', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const retVal: any = {};
    const info = $$.SANDBOX.stub($$.TEST_LOGGER, 'info');
    const wildKey = 'some wildAnd-Crazy_key';
    const tableData = [
      { foo: 'amazing!', bar: 3, baz: true },
      { foo: 'incredible!', bar: 0, baz: false },
      { foo: 'truly amazing!', bar: 9, baz: true },
    ];
    const expectedOptions = {
      columns: [
        { key: 'foo', label: 'FOO' },
        { key: 'bar', label: 'BAR' },
        { key: 'baz', label: 'BAZ' },
        { key: wildKey, label: 'SOME WILD AND CRAZY KEY' },
      ],
    };
    const tableGetter = () => (x: typeof tableData, y: typeof expectedOptions) => {
      retVal.x = x;
      retVal.y = y;
    };
    $$.SANDBOX.stub(cli, 'table').get(tableGetter);
    const ux = new UX($$.TEST_LOGGER, true, cli);
    const options = ['foo', 'bar', 'baz', wildKey];

    const ux1 = ux.table(tableData, options);

    expect(info.called).to.equal(true);
    expect(info.firstCall.args[0]).to.equal(tableData);
    expect(retVal.x).to.deep.equal(tableData);
    expect(retVal.y).to.deep.equal(expectedOptions);
    expect(ux1).to.equal(ux);
  });

  it('table() should log to the logger and output in table format when output IS enabled with complex column config', () => {
    const retVal: Dictionary = {};
    const info = $$.SANDBOX.stub($$.TEST_LOGGER, 'info');
    const tableData = [
      { foo: 'amazing!', bar: 3, baz: true },
      { foo: 'incredible!', bar: 0, baz: false },
      { foo: 'truly amazing!', bar: 9, baz: true },
    ];
    const options = {
      columns: [
        { key: 'foo' },
        {
          key: 'bar',
          label: '*** BAR ***',
          // (matches oclif)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          format: (val: any) => (val != null ? val.toString() : ''),
        },
        { key: 'baz', label: 'ZaB' },
      ],
    };
    const tableGetter = () => (x: typeof tableData, y: typeof options) => {
      retVal.x = x;
      retVal.y = y;
    };
    $$.SANDBOX.stub(cli, 'table').get(tableGetter);
    const ux = new UX($$.TEST_LOGGER, true, cli);

    const ux1 = ux.table(tableData, options);

    expect(info.called).to.equal(true);
    expect(info.firstCall.args[0]).to.equal(tableData);
    expect(retVal.x).to.deep.equal(tableData);
    expect(retVal.y).to.deep.equal(options);
    expect(ux1).to.equal(ux);
  });

  it('prompt() should call the cli.prompt() method', async () => {
    const question = 'City?';
    const answer = 'Louisville';
    const ux = new UX($$.TEST_LOGGER, true, cli);
    const promptGetter = () => (name: string, options: object) => {
      expect(name).to.equal(question);
      expect(options).to.eql({});
      return answer;
    };
    $$.SANDBOX.stub(cli, 'prompt').get(promptGetter);
    const response = await ux.prompt(question);
    expect(response).to.equal(answer);
  });

  it('confirm() should call the cli.confirm() method', async () => {
    const question = 'Yes?';
    const answer = true;
    const ux = new UX($$.TEST_LOGGER, true, cli);
    const confirmGetter = () => (msg: string) => {
      expect(msg).to.equal(question);
      return answer;
    };
    $$.SANDBOX.stub(cli, 'confirm').get(confirmGetter);
    const response = await ux.confirm(question);
    expect(response).to.equal(answer);
  });

  describe('spinner tests', () => {
    it('startSpinner() should call action.start()', () => {
      const ux = new UX($$.TEST_LOGGER, true, cli);
      const start = $$.SANDBOX.stub(cli.action, 'start');
      ux.startSpinner('test message');
      expect(start.called).to.equal(true);
    });

    it('startSpinner() should call action.start() with all parameters', () => {
      const ux = new UX($$.TEST_LOGGER, true, cli);
      const start = $$.SANDBOX.stub(cli.action, 'start');
      ux.startSpinner('test message', 'test status', { stdout: true });
      expect(start.called).to.equal(true);
      expect(start.firstCall.args[0]).to.equal('test message');
      expect(start.firstCall.args[1]).to.equal('test status');
      expect(start.firstCall.args[2]?.stdout).to.equal(true);
    });

    it("startSpinner() shouldn't call action.start()", () => {
      const ux = new UX($$.TEST_LOGGER, false, cli);
      const start = $$.SANDBOX.stub(cli.action, 'start');
      ux.startSpinner('test message');
      expect(start.called).to.equal(false);
    });

    it('pauseSpinner() should call action.pause()', () => {
      const ux = new UX($$.TEST_LOGGER, true, cli);
      const pause = $$.SANDBOX.stub(cli.action, 'pause');
      ux.pauseSpinner(() => {});
      expect(pause.called).to.equal(true);
    });

    it("pauseSpinner() shouldn't call action.pause()", () => {
      const ux = new UX($$.TEST_LOGGER, false, cli);
      const pause = $$.SANDBOX.stub(cli.action, 'pause');
      ux.pauseSpinner(() => {});
      expect(pause.called).to.equal(false);
    });

    it('getSpinnerStatus() and setSpinnerStatus() get and set the status on action', () => {
      const ux = new UX($$.TEST_LOGGER, false, cli);
      ux.cli.action.task = { action: 'spinner', status: 'old status', active: true };
      expect(ux.getSpinnerStatus()).to.equal(undefined);
    });

    it('stopSpinner() should call action.stop()', () => {
      const ux = new UX($$.TEST_LOGGER, true, cli);
      const stop = $$.SANDBOX.stub(cli.action, 'stop');
      ux.stopSpinner('test message');
      expect(stop.called).to.equal(true);
    });

    it("stopSpinner() shouldn't call action.stop()", () => {
      const ux = new UX($$.TEST_LOGGER, false, cli);
      const stop = $$.SANDBOX.stub(cli.action, 'stop');
      ux.stopSpinner('test message');
      expect(stop.called).to.equal(false);
    });
  });

  describe('warn()', () => {
    after(() => {
      UX.warnings.clear();
    });

    it('warn() should only log to the logger when logLevel > WARN', () => {
      $$.TEST_LOGGER.setLevel(Logger.getLevelByName('error'));
      const loggerWarn = $$.SANDBOX.stub($$.TEST_LOGGER, 'warn');
      const consoleWarn = $$.SANDBOX.stub(console, 'warn');
      const ux = new UX($$.TEST_LOGGER, false, cli);
      const logMsg = 'test warn() 1 for log wrapper';

      const ux1 = ux.warn(logMsg);

      expect(loggerWarn.called).to.equal(true);
      expect(loggerWarn.firstCall.args[0]).to.equal('WARNING:');
      expect(loggerWarn.firstCall.args[1]).to.equal(logMsg);
      expect(consoleWarn.called).to.equal(false);
      expect(UX.warnings.size).to.equal(0);
      expect(ux1).to.equal(ux);
    });

    it('warn() should log to the logger and stderr when logLevel <= WARN and output enabled', () => {
      $$.TEST_LOGGER.setLevel(Logger.getLevelByName('warn'));
      const loggerWarn = $$.SANDBOX.stub($$.TEST_LOGGER, 'warn');
      const consoleWarn = $$.SANDBOX.stub(console, 'warn');
      const ux = new UX($$.TEST_LOGGER, true, cli);
      const logMsg = 'test warn() 1 for log wrapper\n';

      const ux1 = ux.warn(logMsg);

      expect(loggerWarn.called).to.equal(true);
      expect(loggerWarn.firstCall.args[0]).to.equal('WARNING:');
      expect(loggerWarn.firstCall.args[1]).to.equal(logMsg);
      expect(consoleWarn.called).to.equal(true);
      expect(UX.warnings.size).to.equal(0);
      expect(ux1).to.equal(ux);
    });

    it('warn() should log to the logger and add to warnings Set when logLevel <= WARN and output NOT enabled', () => {
      $$.TEST_LOGGER.setLevel(Logger.getLevelByName('warn'));
      const loggerWarn = $$.SANDBOX.stub($$.TEST_LOGGER, 'warn');
      const consoleWarn = $$.SANDBOX.stub(console, 'warn');
      const ux = new UX($$.TEST_LOGGER, false, cli);
      const logMsg = 'test warn() 1 for log wrapper';

      const ux1 = ux.warn(logMsg);

      expect(loggerWarn.called).to.equal(true);
      expect(loggerWarn.firstCall.args[0]).to.equal('WARNING:');
      expect(loggerWarn.firstCall.args[1]).to.equal(logMsg);
      expect(consoleWarn.called).to.equal(false);
      expect(UX.warnings.size).to.equal(1);
      expect(Array.from(UX.warnings)[0]).to.equal(logMsg);
      expect(ux1).to.equal(ux);
    });
  });
});
