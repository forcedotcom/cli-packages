/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { fail } from 'assert';
import { join } from 'path';
import { URL } from 'url';
import * as util from 'util';
import { IConfig } from '@oclif/config';
import {
  ConfigAggregator,
  Global,
  Lifecycle,
  Logger,
  LoggerLevel,
  Messages,
  Mode,
  Org,
  SfdxError,
  SfdxProject,
} from '@salesforce/core';
import { testSetup } from '@salesforce/core/lib/testSetup';
import { cloneJson, Duration, env, isEmpty } from '@salesforce/kit';
import { stubInterface } from '@salesforce/ts-sinon';
import { AnyJson, Dictionary, ensureJsonMap, JsonArray, JsonMap, keysOf, Optional } from '@salesforce/ts-types';
import { expect } from 'chai';
import chalk from 'chalk';
import { SinonStub } from 'sinon';
import { Result, SfdxCommand, SfdxResult } from '../../src/sfdxCommand';
import { flags, FlagsConfig } from '../../src/sfdxFlags';
import { UX } from '../../src/ux';

chalk.enabled = false;

Messages.importMessagesDirectory(join(__dirname, '..'));
const messages: Messages = Messages.loadMessages('@salesforce/command', 'flags');

const $$ = testSetup();

interface TestCommandMeta {
  cmd: typeof SfdxCommand; // the command constructor props
  cmdInstance: SfdxCommand; // the command instance props
}
// An object to keep track of what is set on the test command constructor and instance by SfdxCommand
let testCommandMeta: TestCommandMeta;

// The test command
class BaseTestCommand extends SfdxCommand {
  public static output: string | JsonArray = 'default test output';
  public static flagsConfig: FlagsConfig = {
    flag1: flags.string({ char: 'f', description: 'my desc' }),
  };
  public static result: Dictionary;
  protected readonly lifecycleEventNames = ['test1', 'test2'];
  protected get statics(): typeof BaseTestCommand {
    return this.constructor as typeof BaseTestCommand;
  }

  public async run() {
    testCommandMeta = {
      cmdInstance: this,
      cmd: this.statics,
    };
    return this.statics.output;
  }
}

// Props that should always be added to the test command constructor
const DEFAULT_CMD_PROPS = {
  flags: {
    json: { type: 'boolean' },
    loglevel: { type: 'option' },
  },
};

// Props that should always be added to the test command instance
const DEFAULT_INSTANCE_PROPS = {
  flags: {
    loglevel: LoggerLevel[Logger.DEFAULT_LEVEL].toLowerCase(),
  },
  args: {},
  isJson: false,
  logger: $$.TEST_LOGGER,
  configAggregator: { getInfo: () => ({ value: undefined }) },
  org: undefined,
  hubOrg: undefined,
  project: undefined,
};

// Initial state of UX output by the command.
const UX_OUTPUT_BASE = {
  log: new Array<string[]>(),
  logJson: new Array<AnyJson>(),
  error: new Array<string[]>(),
  errorJson: new Array<AnyJson>(),
  table: new Array<string[]>(),
  warn: new Array<string[]>(),
};

// Actual UX output by the command
let UX_OUTPUT: typeof UX_OUTPUT_BASE;
let configAggregatorCreate: SinonStub;
let jsonToStdout: boolean;

async function mockStdout(test: (outLines: string[]) => Promise<void>) {
  const oldStdoutWriter = process.stdout.write.bind(process.stdout);
  const lines: string[] = [];
  // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
  // @ts-ignore
  process.stdout.write = (message) => {
    if (message) {
      lines.push(message);
    }
  };

  try {
    await test(lines);
  } finally {
    process.stdout.write = oldStdoutWriter;
  }
}

describe('SfdxCommand', () => {
  beforeEach(() => {
    process.exitCode = 0;

    UX_OUTPUT = cloneJson(UX_OUTPUT_BASE);
    configAggregatorCreate = $$.SANDBOX.stub(ConfigAggregator, 'create').returns(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Promise.resolve(DEFAULT_INSTANCE_PROPS.configAggregator) as any
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $$.SANDBOX.stub(Global, 'getEnvironmentMode').returns({ is: () => false } as any);

    // Stub all UX methods to update the UX_OUTPUT object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $$.SANDBOX.stub(UX.prototype, 'log').callsFake((args: any) => UX_OUTPUT.log.push(args) as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $$.SANDBOX.stub(UX.prototype, 'logJson').callsFake((args: any) => UX_OUTPUT.logJson.push(args) as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $$.SANDBOX.stub(UX.prototype, 'error').callsFake((...args: any[]) => UX_OUTPUT.error.push(args) as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $$.SANDBOX.stub(UX.prototype, 'errorJson').callsFake((args: any) => UX_OUTPUT.errorJson.push(args) as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $$.SANDBOX.stub(UX.prototype, 'table').callsFake((args: any[]) => UX_OUTPUT.table.push(args) as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $$.SANDBOX.stub(UX.prototype, 'warn').callsFake(function (this: UX, args: string[]) {
      UX_OUTPUT.warn.push(args);
      UX.warnings.add(util.format(args));
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    // Ensure BaseTestCommand['result'] is not defined before all tests
    BaseTestCommand.result = {};

    // Ensure BaseTestCommand.flagsConfig is returned to base state
    BaseTestCommand.flagsConfig = {
      flag1: flags.string({ char: 'f', description: 'my desc' }),
    };

    jsonToStdout = env.getBoolean('SFDX_JSON_TO_STDOUT');
    env.unset('SFDX_JSON_TO_STDOUT');

    UX.warnings.clear();
  });

  afterEach(() => {
    UX.warnings = new Set();
    env.setBoolean('SFDX_JSON_TO_STDOUT', jsonToStdout);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function verifyCmdFlags(verifications: Dictionary<any>) {
    const merged = Object.assign({}, DEFAULT_CMD_PROPS.flags, verifications);
    const numOfFlagsMessage = 'Number of flag definitions for the command should match';
    expect(keysOf(testCommandMeta.cmd.flags).length, numOfFlagsMessage).to.equal(keysOf(merged).length);
    keysOf(merged).forEach((key) => {
      expect(testCommandMeta.cmd.flags, `test for flag: ${key}`).to.have.property(key).and.include(merged[key]);
    });
  }

  function verifyInstanceProps(props: Dictionary = {}) {
    const merged = Object.assign({}, DEFAULT_INSTANCE_PROPS, props);
    keysOf(testCommandMeta.cmdInstance)
      .filter((key) => !!merged[key])
      .forEach((key) => {
        expect(testCommandMeta.cmdInstance[key], `test for instance prop: ${key}`).to.deep.equal(merged[key]);
      });

    expect(testCommandMeta.cmdInstance['ux']).to.be.ok.and.be.instanceof(UX);
  }

  function verifyUXOutput(output = {}) {
    const out = Object.assign({}, UX_OUTPUT_BASE, output);
    keysOf(out).forEach((key) => {
      expect(UX_OUTPUT[key], `test UX output for ${key}()`).to.deep.equal(out[key]);
    });
  }

  it('should type this', () => {
    let result: JsonMap = {};
    const x: SfdxResult = {
      display(): void {
        result = ensureJsonMap(this.data);
      },
    };
    if (x.display) {
      const resultStub = stubInterface<Result>($$.SANDBOX, { data: { foo: 'bar' } });
      x.display.call(resultStub);
      expect(result).to.have.property('foo', 'bar');
    }
  });

  it('should always add SfdxCommand required flags (--json and --loglevel)', async () => {
    // Run the command
    class TestCommand extends BaseTestCommand {}
    const output = await TestCommand.run([]);

    expect(output).to.equal(TestCommand.output);
    expect(testCommandMeta.cmd.args, 'TestCommand.args should be undefined').to.equal(undefined);
    verifyCmdFlags({ flag1: { type: 'option' } });
    verifyInstanceProps();
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData: undefined,
    };
    expect(testCommandMeta.cmdInstance['result']).to.include(expectedResult);
    verifyUXOutput();
  });

  it('should add SfdxCommand targetusername and apiversion flags with supportsUsername', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fakeOrg: any = 'fake_org';
    $$.SANDBOX.stub(Org, 'create').returns(fakeOrg);
    class TestCommand extends BaseTestCommand {}
    TestCommand['supportsUsername'] = true;

    // Run the command
    const output = await TestCommand.run([]);

    expect(output).to.equal(TestCommand.output);
    expect(testCommandMeta.cmd.args, 'TestCommand.args should be undefined').to.equal(undefined);
    verifyCmdFlags({
      flag1: { type: 'option' },
      targetusername: { type: 'option' },
      apiversion: { type: 'option' },
    });
    verifyInstanceProps({ org: fakeOrg });
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData: undefined,
    };
    expect(testCommandMeta.cmdInstance['result']).to.include(expectedResult);
    verifyUXOutput();
  });

  it('should add SfdxCommand targetusername and apiversion flags with requiresUsername', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fakeOrg: any = 'fake_org';
    $$.SANDBOX.stub(Org, 'create').returns(fakeOrg);
    class TestCommand extends BaseTestCommand {}
    TestCommand['requiresUsername'] = true;

    // Run the command
    const output = await TestCommand.run([]);

    expect(output).to.equal(TestCommand.output);
    expect(testCommandMeta.cmd.args, 'TestCommand.args should be undefined').to.equal(undefined);
    verifyCmdFlags({
      flag1: { type: 'option' },
      targetusername: { type: 'option' },
      apiversion: { type: 'option' },
    });
    verifyInstanceProps({ org: fakeOrg });
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData: undefined,
    };
    expect(testCommandMeta.cmdInstance['result']).to.include(expectedResult);
    verifyUXOutput();
  });

  it('should add SfdxCommand targetdevhubusername and apiversion flags with supportsDevhubUsername', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fakeOrg: any = 'fake_devhub_org';
    $$.SANDBOX.stub(Org, 'create').returns(fakeOrg);
    class TestCommand extends BaseTestCommand {}
    TestCommand['supportsDevhubUsername'] = true;

    // Run the command
    const output = await TestCommand.run([]);

    expect(output).to.equal(TestCommand.output);
    expect(testCommandMeta.cmd.args, 'TestCommand.args should be undefined').to.equal(undefined);
    verifyCmdFlags({
      flag1: { type: 'option' },
      targetdevhubusername: { type: 'option' },
      apiversion: { type: 'option' },
    });
    verifyInstanceProps({ hubOrg: fakeOrg });
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData: undefined,
    };
    expect(testCommandMeta.cmdInstance['result']).to.include(expectedResult);
    verifyUXOutput();
  });

  it('should add SfdxCommand targetdevhubusername and apiversion flags with requiresDevhubUsername', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fakeOrg: any = 'fake_devhub_org';
    $$.SANDBOX.stub(Org, 'create').returns(fakeOrg);
    class TestCommand extends BaseTestCommand {}
    TestCommand['requiresDevhubUsername'] = true;

    // Run the command
    const output = await TestCommand.run([]);

    expect(output).to.equal(TestCommand.output);
    expect(testCommandMeta.cmd.args, 'TestCommand.args should be undefined').to.equal(undefined);
    verifyCmdFlags({
      flag1: { type: 'option' },
      targetdevhubusername: { type: 'option' },
      apiversion: { type: 'option' },
    });
    verifyInstanceProps({ hubOrg: fakeOrg });
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData: undefined,
    };
    expect(testCommandMeta.cmdInstance['result']).to.include(expectedResult);
    verifyUXOutput();
  });

  it('should set apiversion', async () => {
    let apiVersion: string;
    $$.SANDBOX.stub(Org, 'create').returns({
      getConnection: () => ({
        setApiVersion: (version: string) => {
          apiVersion = version;
        },
        getApiVersion: () => apiVersion,
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    // Run the command
    class ApiVersionCommand extends SfdxCommand {
      protected static requiresUsername = true;
      public async run() {
        expect(this.org && this.org.getConnection().getApiVersion()).to.equal('40.0');
        return { finished: true };
      }
    }
    const output = await ApiVersionCommand.run(['--apiversion=40.0']);
    expect(output.finished).to.be.true;
  });

  it('should add a project when requiresProject is true', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fakeProject: any = 'fake_project';
    $$.SANDBOX.stub(SfdxProject, 'resolve').withArgs().returns(fakeProject);
    class TestCommand extends BaseTestCommand {}
    TestCommand['requiresProject'] = true;

    // Run the command
    const output = await TestCommand.run([]);

    expect(output).to.equal(TestCommand.output);
    expect(testCommandMeta.cmd.args, 'TestCommand.args should be undefined').to.equal(undefined);
    verifyCmdFlags({
      flag1: { type: 'option' },
    });
    verifyInstanceProps({ project: fakeProject });
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData: undefined,
    };
    expect(testCommandMeta.cmdInstance['result']).to.include(expectedResult);
    verifyUXOutput();
  });

  it('should add an SFDX flag when enabled from flagsConfig', async () => {
    class TestCommand extends BaseTestCommand {}
    TestCommand.flagsConfig.verbose = flags.builtin();

    // Run the command
    const output = await TestCommand.run([]);

    expect(output).to.equal(TestCommand.output);
    expect(testCommandMeta.cmd.args, 'TestCommand.args should be undefined').to.equal(undefined);
    verifyCmdFlags({
      flag1: { type: 'option' },
      verbose: { type: 'boolean' },
    });
    verifyInstanceProps();
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData: undefined,
    };
    expect(testCommandMeta.cmdInstance['result']).to.include(expectedResult);
    verifyUXOutput();
  });

  it('should add args and flags to the command instance', async () => {
    class TestCommand extends BaseTestCommand {}
    const cmdArgs = [{ name: 'file' }];
    TestCommand['args'] = cmdArgs;

    // Run the command
    const output = await TestCommand.run(['arg1_val', '--flag1', 'flag1_val']);

    expect(output).to.equal(TestCommand.output);
    expect(testCommandMeta.cmd.args, 'TestCommand.args').to.equal(cmdArgs);
    verifyCmdFlags({
      flag1: { type: 'option' },
    });
    verifyInstanceProps({
      flags: Object.assign({ flag1: 'flag1_val' }, DEFAULT_INSTANCE_PROPS.flags),
      args: { file: 'arg1_val' },
    });
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData: undefined,
    };
    expect(testCommandMeta.cmdInstance['result']).to.include(expectedResult);
    verifyUXOutput();
  });

  it('should honor the -h flag to generate help output when the subclass does not define its own flag for -h', async () => {
    class TestCommand extends BaseTestCommand {}

    return mockStdout(async (lines: string[]) => {
      let output: Optional<string>;
      try {
        output = await TestCommand.run(['-h']);
        fail('Expected EEXIT error');
      } catch (err) {
        expect(err.code).to.equal('EEXIT');
        expect(err.oclif.exit).to.equal(0);
      }

      expect(output).to.equal(undefined);
      expect(process.exitCode).to.equal(0);

      // Check that the first line of the logged output is `USAGE` once ANSI colors have been removed
      expect(lines.length).to.be.gte(1);
      // eslint-disable-next-line no-control-regex
      const help = lines[0].slice(0, lines[0].indexOf('\n')).replace(/\u001b\[[0-9]+m/g, '');
      expect(help).to.equal('USAGE');
    });
  });

  it('should honor the -h flag to generate help output, even when the subclass defines its own help flag', () => {
    class TestCommand extends BaseTestCommand {
      public static flagsConfig = {
        help: flags.help({ char: 'h' }),
      };
    }

    return mockStdout(async (lines: string[]) => {
      // Run the command

      let output: Optional<string>;
      try {
        output = await TestCommand.run(['-h']);
        fail('Expected EEXIT error');
      } catch (err) {
        expect(err.code).to.equal('EEXIT');
        expect(err.oclif.exit).to.equal(0);
      }

      expect(output).to.equal(undefined);
      expect(process.exitCode).to.equal(0);
      // Check that the first line of the logged output is `USAGE` once ANSI colors have been removed
      expect(lines.length).to.be.gte(1);
      // eslint-disable-next-line no-control-regex
      const help = lines[0].slice(0, lines[0].indexOf('\n')).replace(/\u001b\[[0-9]+m/g, '');
      expect(help).to.equal('USAGE');
    });
  });

  it('should not honor the -h flag to generate help output when used for another purpose by the subclass', () => {
    class TestCommand extends BaseTestCommand {
      public static flagsConfig = {
        foo: flags.boolean({ char: 'h', description: 'foo' }),
      };
    }

    return mockStdout(async () => {
      const output = await TestCommand.run(['-h']);

      expect(output).to.equal(TestCommand.output);
      expect(testCommandMeta.cmd.args, 'TestCommand.args should be undefined').to.equal(undefined);
      verifyInstanceProps({
        flags: Object.assign({ foo: true }, DEFAULT_INSTANCE_PROPS.flags),
      });
      const expectedResult = {
        data: TestCommand.output,
        tableColumnData: undefined,
      };
      expect(testCommandMeta.cmdInstance['result']).to.include(expectedResult);
      verifyUXOutput();
    });
  });

  describe('JSON', () => {
    afterEach(() => {
      env.unset('SFDX_CONTENT_TYPE');
    });

    it('should set this.isJson and only output ux.logJson with the --json flag', async () => {
      // Run the command
      class TestCommand extends BaseTestCommand {}
      const output = await TestCommand.run(['--json']);

      expect(output).to.equal(TestCommand.output);
      expect(testCommandMeta.cmd.args, 'TestCommand.args should be undefined').to.equal(undefined);
      verifyCmdFlags({ flag1: { type: 'option' } });
      verifyInstanceProps({
        flags: Object.assign({ json: true }, DEFAULT_INSTANCE_PROPS.flags),
        isJson: true,
      });
      const expectedResult = {
        data: TestCommand.output,
        tableColumnData: undefined,
      };
      expect(testCommandMeta.cmdInstance['result']).to.include(expectedResult);
      verifyUXOutput({ logJson: [{ status: 0, result: TestCommand.output }] });
    });

    it('should set this.isJson and only output ux.logJson with SFDX_CONTENT_TYPE=JSON', async () => {
      // Run the command
      class TestCommand extends BaseTestCommand {}

      env.setString('SFDX_CONTENT_TYPE', 'Json');
      const output = await TestCommand.run([]);

      expect(output).to.equal(TestCommand.output);
      expect(testCommandMeta.cmd.args, 'TestCommand.args should be undefined').to.equal(undefined);
      verifyCmdFlags({ flag1: { type: 'option' } });
      verifyInstanceProps({
        flags: Object.assign({ json: true }, DEFAULT_INSTANCE_PROPS.flags),
        isJson: true,
      });
      const expectedResult = {
        data: TestCommand.output,
        tableColumnData: undefined,
      };
      expect(testCommandMeta.cmdInstance['result']).to.include(expectedResult);
      verifyUXOutput({ logJson: [{ status: 0, result: TestCommand.output }] });
    });
  });

  it('should allow adding information to the returned object for --json', async () => {
    // Run the command
    class TestCommand extends BaseTestCommand {
      protected getJsonResultObject(result: AnyJson, status: number) {
        return Object.assign(super.getJsonResultObject(result, status), {
          myData: 'test',
        });
      }
    }
    const output = await TestCommand.run(['--json']);

    expect(output).to.equal(TestCommand.output);
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData: undefined,
    };
    expect(testCommandMeta.cmdInstance['result']).to.include(expectedResult);
    verifyUXOutput({ logJson: [{ status: 0, result: TestCommand.output, myData: 'test' }] });
  });

  it('should set the logLevel on the SfdxCommand logger with the --loglevel flag', async () => {
    // Run the command
    class TestCommand extends BaseTestCommand {}
    const loglevel = 'info';
    const output = await TestCommand.run(['--loglevel', loglevel]);

    expect(output).to.equal(TestCommand.output);
    expect(testCommandMeta.cmd.args, 'TestCommand.args should be undefined').to.equal(undefined);
    verifyCmdFlags({ flag1: { type: 'option' } });
    verifyInstanceProps({
      flags: { loglevel },
    });
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData: undefined,
    };
    expect(testCommandMeta.cmdInstance['result']).to.include(expectedResult);
    verifyUXOutput();
    expect(testCommandMeta.cmdInstance['logger'].getLevel()).to.equal(LoggerLevel.INFO);
  });

  it('should set the logLevel on the SfdxCommand logger with the --loglevel flag with an uppercase value', async () => {
    // Run the command
    class TestCommand extends BaseTestCommand {}
    const loglevel = 'INFO';
    const output = await TestCommand.run(['--loglevel', loglevel]);

    expect(output).to.equal(TestCommand.output);
    expect(testCommandMeta.cmd.args, 'TestCommand.args should be undefined').to.equal(undefined);
    verifyCmdFlags({ flag1: { type: 'option' } });
    verifyInstanceProps({
      flags: { loglevel: loglevel.toLowerCase() },
    });
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData: undefined,
    };
    expect(testCommandMeta.cmdInstance['result']).to.include(expectedResult);
    verifyUXOutput();
    expect(testCommandMeta.cmdInstance['logger'].getLevel()).to.equal(LoggerLevel.INFO);
  });

  it('should use table formatting with tableColumnData prop', async () => {
    // Run the command
    class TestCommand extends BaseTestCommand {}
    const tableColumnData = ['foo', 'bar', 'baz'];
    TestCommand['tableColumnData'] = tableColumnData;
    TestCommand.output = [
      { foo: 1000, bar: 'moscow mule', baz: false },
      { foo: 2000, bar: 'The Melvin', baz: true },
      { foo: 3000, bar: 'NE IPA', baz: true },
      { foo: 4000, bar: 'Guinness', baz: 0 },
    ];
    const output = await TestCommand.run([]);

    expect(output).to.equal(TestCommand.output);
    expect(testCommandMeta.cmd.args, 'TestCommand.args should be undefined').to.equal(undefined);
    verifyCmdFlags({ flag1: { type: 'option' } });
    verifyInstanceProps();
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData,
    };
    expect(testCommandMeta.cmdInstance['result']).to.deep.include(expectedResult);
    verifyUXOutput({ table: [TestCommand.output] });
  });

  it('should output "No results found." when no table results were returned', async () => {
    // Run the command
    class TestCommand extends BaseTestCommand {}
    const tableColumnData = ['foo', 'bar', 'baz'];
    TestCommand['tableColumnData'] = tableColumnData;
    TestCommand.output = [] as JsonArray;
    const output = await TestCommand.run([]);

    expect(output).to.equal(TestCommand.output);
    expect(testCommandMeta.cmd.args, 'TestCommand.args should be undefined').to.equal(undefined);
    verifyCmdFlags({ flag1: { type: 'option' } });
    verifyInstanceProps();
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData,
    };
    expect(testCommandMeta.cmdInstance['result']).to.deep.include(expectedResult);
    verifyUXOutput({ log: ['No results found.'] });
  });

  it('should use table formatting with result.tableColumnData object', async () => {
    // Run the command
    class TestCommand extends BaseTestCommand {}
    const tableColumnData = ['foo', 'bar', 'baz'];
    TestCommand['result']['tableColumnData'] = tableColumnData;
    TestCommand.output = [
      { foo: 1000, bar: 'moscow mule', baz: false },
      { foo: 2000, bar: 'The Melvin', baz: true },
      { foo: 3000, bar: 'NE IPA', baz: true },
      { foo: 4000, bar: 'Guinness', baz: 0 },
    ];
    const output = await TestCommand.run([]);

    expect(output).to.equal(TestCommand.output);
    expect(testCommandMeta.cmd.args, 'TestCommand.args should be undefined').to.equal(undefined);
    verifyCmdFlags({ flag1: { type: 'option' } });
    verifyInstanceProps();
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData,
    };
    expect(testCommandMeta.cmdInstance['result']).to.deep.include(expectedResult);
    verifyUXOutput({ table: [TestCommand.output] });
  });

  it('should check the shape of SfdxResult', async () => {
    // Run the command
    const tableColumnData = {
      columns: [
        { key: 'foo', label: 'Foo' },
        { key: 'bar', label: 'Bar' },
        { key: 'baz', label: 'Baz' },
      ],
    };
    // Implement a new command here to ensure the compiler checks the shape of `result`
    class MyTestCommand extends BaseTestCommand {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      public static result: any = {
        tableColumnData,
        display() {
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          this.ux.log(`CUSTOM: ${this.data}`);
        },
      };
    }
    MyTestCommand.output = [
      { Foo: 1000, Bar: 'moscow mule', Baz: false },
      { Foo: 2000, Bar: 'The Melvin', Baz: true },
      { Foo: 3000, Bar: 'NE IPA', Baz: true },
      { Foo: 4000, Bar: 'Guinness', Baz: 0 },
    ];
    const output = await MyTestCommand.run([]);

    expect(output).to.equal(MyTestCommand.output);
    expect(testCommandMeta.cmd.args, 'TestCommand.args should be undefined').to.equal(undefined);
    verifyCmdFlags({ flag1: { type: 'option' } });
    verifyInstanceProps();
    const expectedResult = {
      data: MyTestCommand.output,
      tableColumnData,
    };
    expect(testCommandMeta.cmdInstance['result']).to.deep.include(expectedResult);
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    verifyUXOutput({ log: [`CUSTOM: ${MyTestCommand.output}`] });
  });

  it('should override result display with result.display prop', async () => {
    // Run the command
    class TestCommand extends BaseTestCommand {}
    TestCommand['result']['display'] = function (this: Result) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      this.ux.log(`CUSTOM: ${this.data}`);
    };
    TestCommand.output = 'new string output';
    const output = await TestCommand.run([]);

    expect(output).to.equal(TestCommand.output);
    expect(testCommandMeta.cmd.args, 'TestCommand.args should be undefined').to.equal(undefined);
    verifyCmdFlags({ flag1: { type: 'option' } });
    verifyInstanceProps();
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData: undefined,
    };
    expect(testCommandMeta.cmdInstance['result']).to.deep.include(expectedResult);
    verifyUXOutput({ log: [`CUSTOM: ${TestCommand.output}`] });
  });

  it('should warn when apiVersion is being overridden via config', async () => {
    const apiVersion = '42.0';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const configAggregator: any = {
      getInfo: () => ({ value: apiVersion }),
    };
    configAggregatorCreate.restore();
    configAggregatorCreate = $$.SANDBOX.stub(ConfigAggregator, 'create').returns(configAggregator);

    // Run the command
    class TestCommand extends BaseTestCommand {}
    const output = await TestCommand.run([]);

    expect(output).to.equal(TestCommand.output);
    expect(testCommandMeta.cmd.args, 'TestCommand.args should be undefined').to.equal(undefined);
    verifyCmdFlags({ flag1: { type: 'option' } });
    verifyInstanceProps({ configAggregator });
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData: undefined,
    };
    expect(testCommandMeta.cmdInstance['result']).to.include(expectedResult);
    verifyUXOutput({
      warn: [`apiVersion configuration overridden at "${apiVersion}"`],
    });
  });

  it('should NOT warn when apiVersion is overridden via a flag', async () => {
    const apiVersion = '42.0';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const configAggregator: any = {
      getInfo: () => ({ value: apiVersion }),
    };
    configAggregatorCreate.restore();
    configAggregatorCreate = $$.SANDBOX.stub(ConfigAggregator, 'create').returns(configAggregator);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fakeOrg: any = 'fake_org';
    $$.SANDBOX.stub(Org, 'create').returns(fakeOrg);

    // Run the command
    class TestCommand extends BaseTestCommand {}
    TestCommand['supportsUsername'] = true;
    const apiversionFlagVal = '43.0';
    const output = await TestCommand.run(['--apiversion', apiversionFlagVal]);

    expect(output).to.equal(TestCommand.output);
    expect(testCommandMeta.cmd.args, 'TestCommand.args should be undefined').to.equal(undefined);
    verifyCmdFlags({
      flag1: { type: 'option' },
      targetusername: { type: 'option' },
      apiversion: { type: 'option' },
    });
    verifyInstanceProps({
      configAggregator,
      org: fakeOrg,
      flags: Object.assign({ apiversion: apiversionFlagVal }, DEFAULT_INSTANCE_PROPS.flags),
    });
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData: undefined,
    };
    expect(testCommandMeta.cmdInstance['result']).to.include(expectedResult);
    verifyUXOutput();
  });

  it('should throw when a project is required and the command is not run from within a project', async () => {
    $$.SANDBOX.stub(SfdxProject, 'resolve').throws('InvalidProjectWorkspace');
    class TestCommand extends BaseTestCommand {}
    TestCommand['requiresProject'] = true;

    const output = await TestCommand.run([]);

    expect(output).to.equal(undefined);
    expect(process.exitCode).to.equal(1);
    verifyUXOutput({
      error: [['ERROR running TestCommand: ', 'This command is required to run from within an SFDX project.']],
    });
  });

  it('should throw when a username is required and org create fails', async () => {
    $$.SANDBOX.stub(Org, 'create').throws('NoUsername');
    class TestCommand extends BaseTestCommand {}
    TestCommand['requiresUsername'] = true;

    const output = await TestCommand.run([]);

    expect(output).to.equal(undefined);
    expect(process.exitCode).to.equal(1);
    verifyUXOutput({
      error: [
        [
          'ERROR running TestCommand: ',
          'This command requires a username. Specify it with the -u parameter or with the "sfdx config:set defaultusername=<username>" command.',
        ],
      ],
    });
  });

  it('should emit a cmdError event when a command catches an error', async () => {
    $$.SANDBOX.stub(Org, 'create').throws('NoUsername');
    class TestCommand extends BaseTestCommand {
      public static varargs = true;
    }
    TestCommand['requiresUsername'] = true;
    const emitSpy = $$.SANDBOX.spy(process, 'emit');

    await TestCommand.run(['--targetusername', 'foo@bar.org', '--json', 'foo=bar']);

    const expectationMsg = 'Expected the command catch handler to emit a "cmdError" event';
    const expectedFlags = {
      targetusername: 'foo@bar.org',
      loglevel: 'warn',
      json: true,
      foo: 'bar',
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((emitSpy.calledOnceWith as any)('cmdError'), expectationMsg).to.equal(true);
    expect(emitSpy.firstCall.args[0]).to.equal('cmdError');
    expect(emitSpy.firstCall.args[1]).to.be.instanceOf(Error);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((emitSpy.firstCall.args as any)[2]).to.deep.equal(expectedFlags);
  });

  it('should NOT throw when supportsUsername and org create fails', async () => {
    $$.SANDBOX.stub(Org, 'create').throws('NoUsername');
    class TestCommand extends BaseTestCommand {}
    TestCommand['supportsUsername'] = true;

    // Run the command
    const output = await TestCommand.run([]);

    expect(output).to.equal(TestCommand.output);
    expect(testCommandMeta.cmd.args, 'TestCommand.args should be undefined').to.equal(undefined);
    verifyCmdFlags({
      flag1: { type: 'option' },
      targetusername: { type: 'option' },
      apiversion: { type: 'option' },
    });
    verifyInstanceProps();
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData: undefined,
    };
    expect(testCommandMeta.cmdInstance['result']).to.include(expectedResult);
    verifyUXOutput();
  });

  it('should throw when a devhub username is required and org create fails', async () => {
    $$.SANDBOX.stub(Org, 'create').throws('NoUsername');
    class TestCommand extends BaseTestCommand {}
    TestCommand['requiresDevhubUsername'] = true;

    const output = await TestCommand.run([]);

    expect(output).to.equal(undefined);
    expect(process.exitCode).to.equal(1);
    verifyUXOutput({
      error: [
        [
          'ERROR running TestCommand: ',
          'This command requires a dev hub username. Specify it with the -v parameter or with the "sfdx config:set defaultdevhubusername=<username>" command.',
        ],
      ],
    });
  });

  it('should NOT throw when supportsDevhubUsername and org create fails', async () => {
    $$.SANDBOX.stub(Org, 'create').throws('NoUsername');
    class TestCommand extends BaseTestCommand {}
    TestCommand['supportsDevhubUsername'] = true;

    // Run the command
    const output = await TestCommand.run([]);

    expect(output).to.equal(TestCommand.output);
    expect(testCommandMeta.cmd.args, 'TestCommand.args should be undefined').to.equal(undefined);
    verifyCmdFlags({
      flag1: { type: 'option' },
      targetdevhubusername: { type: 'option' },
      apiversion: { type: 'option' },
    });
    verifyInstanceProps();
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData: undefined,
    };
    expect(testCommandMeta.cmdInstance['result']).to.include(expectedResult);
    verifyUXOutput();
  });

  it('should only output to ux.logJson when isJson is true and an error occurs', async () => {
    const sfdxError = new SfdxError('err_msg', 'TestError', ['take action 1'], 100);
    sfdxError.data = 'here is more data';
    sfdxError.stack = 'here is the stack';
    $$.SANDBOX.stub(Org, 'create').throws(sfdxError);
    class TestCommand extends BaseTestCommand {}
    TestCommand['requiresUsername'] = true;

    const output = await TestCommand.run(['--json']);

    expect(output).to.equal(undefined);
    expect(process.exitCode).to.equal(100);
    verifyUXOutput({
      logJson: [
        {
          actions: sfdxError.actions,
          commandName: 'TestCommand',
          data: 'here is more data',
          exitCode: 100,
          message: sfdxError.message,
          name: sfdxError.name,
          result: sfdxError.data,
          stack: sfdxError.stack,
          status: 100,
          warnings: [],
        },
      ],
    });
  });

  it('should only output to ux.logJson when isJson is true and an error occurs with warning', async () => {
    const sfdxError = new SfdxError('err_msg', 'TestError', ['take action 1'], 100);
    sfdxError.data = 'here is more data';
    sfdxError.stack = 'here is the stack';
    $$.SANDBOX.stub(Org, 'create').throws(sfdxError);
    class TestCommand extends BaseTestCommand {}
    TestCommand['requiresUsername'] = true;

    UX.warnings.add('DO NOT USE ME...');
    const output = await TestCommand.run(['--json']);

    expect(output).to.equal(undefined);
    expect(process.exitCode).to.equal(100);
    verifyUXOutput({
      logJson: [
        {
          actions: sfdxError.actions,
          commandName: 'TestCommand',
          data: 'here is more data',
          exitCode: 100,
          message: sfdxError.message,
          name: sfdxError.name,
          result: sfdxError.data,
          stack: sfdxError.stack,
          status: 100,
          warnings: ['DO NOT USE ME...'],
        },
      ],
    });
  });

  it('should register lifecycle events when command is run', async () => {
    Lifecycle.getInstance().removeAllListeners('test1');
    Lifecycle.getInstance().removeAllListeners('test2');

    expect(Lifecycle.getInstance().getListeners('test1').length).to.be.equal(0);
    expect(Lifecycle.getInstance().getListeners('test2').length).to.be.equal(0);

    // Run the command
    class TestCommand extends BaseTestCommand {}
    await TestCommand.run([]);

    expect(Lifecycle.getInstance().getListeners('test1').length).to.be.equal(1);
    expect(Lifecycle.getInstance().getListeners('test2').length).to.be.equal(1);
  });

  describe('Varargs', () => {
    const validator = (name: string, value: unknown) => {
      if (isEmpty(value)) {
        throw Error(`Vararg [${name}] must not be empty.`);
      }
    };

    it('should be added to the command instance when varargs = true', async () => {
      class TestCommand extends BaseTestCommand {}
      TestCommand['varargs'] = true;
      await TestCommand.run(['-f', 'blah', 'foo=bar']);
      expect(testCommandMeta.cmdInstance).to.have.deep.property('varargs', {
        foo: 'bar',
      });
    });

    it('should be added to the command instance when varargs are required', async () => {
      class TestCommand extends BaseTestCommand {}
      TestCommand['varargs'] = { required: true };
      await TestCommand.run(['-f', 'blah', 'foo=bar and this', 'username=me@my.org']);
      expect(testCommandMeta.cmdInstance).to.have.deep.property('varargs', {
        foo: 'bar and this',
        username: 'me@my.org',
      });
    });

    it('should be added to the command instance when varargs pass validation', async () => {
      class TestCommand extends BaseTestCommand {}
      TestCommand['varargs'] = { required: false, validator };
      const cmdArgs = [{ name: 'file' }];
      TestCommand['args'] = cmdArgs;
      await TestCommand.run(['myFile.json', '-f', 'blah', 'foo=bar']);
      expect(testCommandMeta.cmdInstance).to.have.deep.property('varargs', {
        foo: 'bar',
      });
    });

    it('should throw when varargs are required and not provided', async () => {
      class TestCommand extends BaseTestCommand {}
      TestCommand['varargs'] = { required: true, validator };
      await TestCommand.run([]);
      expect(process.exitCode).to.equal(1);
      verifyUXOutput({
        error: [
          [
            'ERROR running TestCommand: ',
            'Provide required name=value pairs for the command. Enclose any values that contain spaces in double quotes.',
          ],
        ],
      });
    });

    it('should throw when varargs are not in the correct format', async () => {
      class TestCommand extends BaseTestCommand {}
      TestCommand['varargs'] = true;
      await TestCommand.run(['-f', 'blah', 'foobar', '=', 'yadda']);
      expect(process.exitCode).to.equal(1);
      verifyUXOutput({
        error: [
          [
            'ERROR running TestCommand: ',
            'Setting variables must be in the format <key>=<value> or <key>="<value with spaces>" but found foobar.',
          ],
        ],
      });
    });

    it('should throw when duplicate varargs are provided', async () => {
      class TestCommand extends BaseTestCommand {}
      TestCommand['varargs'] = { required: false, validator };
      await TestCommand.run(['-f', 'blah', 'foo=bar', 'foo=that']);
      expect(process.exitCode).to.equal(1);
      verifyUXOutput({
        error: [['ERROR running TestCommand: ', "Cannot set variable name 'foo' twice for the same command."]],
      });
    });

    it('should throw when varargs do not pass validation', async () => {
      class TestCommand extends BaseTestCommand {}
      TestCommand['varargs'] = { required: false, validator };
      await TestCommand.run(['-f', 'blah', 'foo=']);
      expect(process.exitCode).to.equal(1);
      verifyUXOutput({
        error: [['ERROR running TestCommand: ', 'Vararg [foo] must not be empty.']],
      });
    });
  });

  describe('SfdxFlags Custom Attributes', () => {
    const ERR_NEXT_STEPS: Dictionary<string> = {
      date: ` ${messages.getMessage('FormattingMessageDate')}`,
      datetime: ` ${messages.getMessage('FormattingMessageDate')}`,
      id: ` ${messages.getMessage('FormattingMessageId')}`,
      url: ` ${messages.getMessage('FormattingMessageUrl')}`,
    };

    async function validateFlag(flagType: keyof typeof flags, val: string, err: boolean) {
      const create = flags[flagType];
      class TestCommand extends BaseTestCommand {
        public static flagsConfig = {
          // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
          // @ts-ignore TODO: why isn't `create` invokable?!
          doflag: create({ char: 'i', description: 'my desc' }),
        };
      }
      const output = await TestCommand.run(['--doflag', val]);
      if (err) {
        const sfdxError = SfdxError.create('@salesforce/command', 'flags', 'InvalidFlagTypeError', [
          val,
          TestCommand.flagsConfig.doflag.kind,
          ERR_NEXT_STEPS[flagType] || '',
        ]);
        expect(output).to.equal(undefined);
        expect(process.exitCode).to.equal(1);
        verifyUXOutput({
          error: [['ERROR running TestCommand: ', sfdxError.message]],
        });
      } else {
        expect(output).to.equal(TestCommand.output);
        verifyUXOutput();
      }
    }

    it('should validate filepath flag type for valid path', async () => {
      return validateFlag('filepath', '/my/path/to/file.txt', false);
    });

    it('should validate directory flag type for invalid path', async () => {
      return validateFlag('directory', '/my/path/to/??file.txt', true);
    });

    it('should validate date flag type for invalid date', async () => {
      return validateFlag('date', 'this is a date', true);
    });

    it('should validate datetime flag type for invalid date', async () => {
      return validateFlag('datetime', '01-02-2018', false);
    });

    it('should validate email flag type for invalid email', async () => {
      return validateFlag('email', 'this is my email', true);
    });

    it('should validate email flag type for a valid email', async () => {
      return validateFlag('email', 'me@my.org', false);
    });

    it('should validate email flag type for invalid email', async () => {
      return validateFlag('email', 'me@my.', true);
    });

    it('should validate array flag type for an array', async () => {
      return validateFlag('array', 'one,two,three', false);
    });

    it('should validate id flag type for a salesforce id', async () => {
      return validateFlag('id', 'a07B0000003uuuuuuu', false);
    });

    it('should validate id flag type for an invalid salesforce id', async () => {
      return validateFlag('id', 'a07B0000003', true);
    });

    it('should validate id flag type for an invalid chars salesforce id', async () => {
      return validateFlag('id', 'a07B00000&*3uuuuuuu', true);
    });

    it('should validate number flag type for an integer', async () => {
      return validateFlag('number', '42', false);
    });

    it('should validate number flag type for a float', async () => {
      return validateFlag('number', '42.0', false);
    });

    it('should validate number flag type for a number with chars', async () => {
      return validateFlag('number', '42foo', true);
    });

    it('should validate number flag type for zero', async () => {
      return validateFlag('number', '0', false);
    });

    it('should validate url flag type for a url that contains whitespace', async () => {
      return validateFlag('url', 'this is a url', true);
    });

    it('should validate url flag type for a url that is valid', async () => {
      return validateFlag('url', 'htttp://salesforce.com', false);
    });

    function validateFlagAttributes(output: unknown, errName: string, flagName: string) {
      const sfdxError = SfdxError.create('@salesforce/command', 'flags', errName, [flagName]);
      expect(output).to.equal(undefined);
      expect(process.exitCode).to.equal(1);
      verifyUXOutput({
        error: [['ERROR running TestCommand: ', sfdxError.message]],
      });
    }

    it('should validate longDescription is string', async () => {
      class TestCommand extends BaseTestCommand {}
      TestCommand.flagsConfig = {
        myflag: flags.string({
          char: 'm',
          // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
          // @ts-ignore ignore invalid longDescription value
          longDescription: false,
          description: 'my desc',
        }),
      };

      const output = await TestCommand.run(['--myflag', 'input']);
      validateFlagAttributes(output, 'InvalidLongDescriptionFormat', 'myflag');
    });

    it('should validate description is defined', async () => {
      class TestCommand extends BaseTestCommand {}
      TestCommand.flagsConfig = {
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore ignore error about not providing description
        myflag: flags.string({ char: 'm' }),
      };
      const output = await TestCommand.run(['--myflag', 'input']);
      validateFlagAttributes(output, 'MissingOrInvalidFlagDescription', 'myflag');
    });

    it('should validate char length is one', async () => {
      class TestCommand extends BaseTestCommand {}
      TestCommand.flagsConfig = {
        myflag: flags.string({
          // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
          // @ts-ignore ignore invalid char value length
          char: 'foo',
          description: 'bar',
        }),
      };
      const output = await TestCommand.run(['--myflag', 'input']);
      validateFlagAttributes(output, 'InvalidFlagChar', 'myflag');
    });

    it('should validate char is alphabetical', async () => {
      class TestCommand extends BaseTestCommand {}
      TestCommand.flagsConfig = {
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore ignore invalid char value
        myflag: flags.string({ char: '5', description: 'bar' }),
      };
      const output = await TestCommand.run(['--myflag', 'input']);
      validateFlagAttributes(output, 'InvalidFlagChar', 'myflag');
    });

    it('should validate flag name is all lowercase', async () => {
      class TestCommand extends BaseTestCommand {}
      TestCommand.flagsConfig = {
        myFlag: {
          char: 'm',
          description: 'foobar',
        },
      };
      const output = await TestCommand.run(['--myFlag', 'input']);
      validateFlagAttributes(output, 'InvalidFlagName', 'myFlag');
    });

    it('should validate flag name is all lowercase for oclif type flags', async () => {
      class TestCommand extends BaseTestCommand {}
      TestCommand.flagsConfig = {
        myFlag: flags.boolean({
          char: 'm',
          description: 'foobar',
        }),
      };
      const output = await TestCommand.run(['--myFlag', 'input']);
      validateFlagAttributes(output, 'InvalidFlagName', 'myFlag');
    });

    it('should validate that undefined is not a valid flag type value', async () => {
      class TestCommand extends BaseTestCommand {}
      TestCommand.flagsConfig = {
        myflag: flags.number({
          char: 'm',
          description: 'my desc',
        }),
      };

      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore Allow undefined array value against the compiler spec to test underlying engine
      const output = await TestCommand.run(['--myflag', undefined]);
      expect(output).to.equal(undefined);
      expect(process.exitCode).to.equal(1);
      verifyUXOutput({
        error: [['ERROR running TestCommand: ', 'Flag --myflag expects a value']],
      });
    });
  });

  describe('flags', () => {
    it('should support all possible flag types', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let inputs: Dictionary<any> = {};

      class FlagsTestCommand extends BaseTestCommand {
        public static flagsConfig: FlagsConfig = {
          // oclif
          boolean: flags.boolean({ description: 'boolean' }),
          enum: flags.enum({ description: 'enum', options: ['e', 'f'] }),
          help: flags.help({ char: 'h' }),
          integer: flags.integer({ description: 'integer' }),
          option: flags.option({ description: 'custom', parse: (val: string) => val.toUpperCase() }),
          string: flags.string({ description: 'string' }),
          version: flags.version(),

          // sfdx
          array: flags.array({ description: 'array' }),
          optsarray: flags.array({ description: 'optsarray', options: ['1', '3', '5'] }),
          intarray: flags.array({ description: 'intarray', map: (v: string) => parseInt(v, 10) }),
          optsintarray: flags.array({
            description: 'optsintarray',
            map: (v: string) => parseInt(v, 10),
            options: [1, 3, 5],
          }),
          date: flags.date({ description: 'date' }),
          datetime: flags.datetime({ description: 'datetime' }),
          directory: flags.directory({ description: 'directory' }),
          email: flags.email({ description: 'some email' }),
          filepath: flags.filepath({ description: 'filepath' }),
          id: flags.id({ description: 'id' }),
          milliseconds: flags.milliseconds({ description: 'milliseconds' }),
          minutes: flags.minutes({ description: 'minutes' }),
          number: flags.number({ description: 'number' }),
          seconds: flags.seconds({ description: 'seconds' }),
          url: flags.url({ description: 'url' }),

          // builtins
          apiversion: flags.builtin(),
          concise: flags.builtin(),
          quiet: flags.builtin(),
          verbose: flags.builtin(),
        };

        public static supportsUsername = true;
        public static supportsDevhubUsername = true;

        public async run() {
          await super.run();
          inputs = this.flags;
          return this.statics.output;
        }
      }

      await FlagsTestCommand.run([
        // oclif
        '--boolean',
        '--enum=e',
        // --help exits, so skip it in this test
        '--integer=10',
        '--option=o',
        '--string=s',
        // --version exits, so skip it in this test

        // sfdx
        '--array=1,2,3',
        '--optsarray=1,3,5',
        '--intarray=1,2,3',
        '--optsintarray=1,3,5',
        '--date=01-02-2000 GMT',
        '--datetime=01/02/2000 01:02:34 GMT',
        '--email=bill@thecat.org',
        '--filepath=/home/someone/.config',
        '--id=00Dxxxxxxxxxxxx',
        '--milliseconds=5000',
        '--minutes=2',
        '--number=0xdeadbeef',
        '--seconds=5',
        '--url=http://example.com/foo/bar',

        // builtins
        '--apiversion=42.0',
        '--concise',
        '--quiet',
        '--verbose',
        '--targetdevhubusername=foo',
        '--targetusername=bar',
      ]);

      expect(inputs.boolean).to.be.true;
      expect(inputs.enum).to.equal('e');
      expect(inputs.integer).to.equal(10);
      expect(inputs.option).to.equal('O');
      expect(inputs.string).to.equal('s');

      expect(inputs.array).to.deep.equal(['1', '2', '3']);
      expect(inputs.optsarray).to.deep.equal(['1', '3', '5']);
      expect(inputs.intarray).to.deep.equal([1, 2, 3]);
      expect(inputs.optsintarray).to.deep.equal([1, 3, 5]);
      expect(inputs.date.toISOString()).to.equal('2000-01-02T00:00:00.000Z');
      expect(inputs.datetime.toISOString()).to.equal('2000-01-02T01:02:34.000Z');
      expect(inputs.email).to.equal('bill@thecat.org');
      expect(inputs.filepath).to.equal('/home/someone/.config');
      expect(inputs.id).to.equal('00Dxxxxxxxxxxxx');
      expect(inputs.milliseconds).to.deep.equal(Duration.milliseconds(5000));
      expect(inputs.minutes).to.deep.equal(Duration.minutes(2));
      expect(inputs.number).to.equal(3735928559); // 0xdeadbeef
      expect(inputs.seconds).to.deep.equal(Duration.seconds(5));
      expect(inputs.url).to.deep.equal(new URL('http://example.com/foo/bar'));

      expect(inputs.apiversion).to.equal('42.0');
      expect(inputs.concise).to.be.true;
      expect(inputs.verbose).to.be.true;
      expect(inputs.targetdevhubusername).to.equal('foo');
      expect(inputs.targetusername).to.equal('bar');
    });
  });

  it('should send errors with --json to stdout by default', async () => {
    // Run the command
    class StderrCommand extends SfdxCommand {
      public async run() {
        throw new Error('Ahhh!');
      }
    }
    const output = await StderrCommand.run(['--json']);
    expect(output).to.equal(undefined);
    expect(process.exitCode).to.equal(1);

    const logJson = UX_OUTPUT['logJson'];
    expect(logJson.length, 'logJson did not get called with error json').to.equal(1);
    const json = ensureJsonMap(logJson[0]);
    expect(json.message, 'logJson did not get called with the right error').to.contains('Ahhh!');
    expect(UX_OUTPUT['errorJson'].length, 'errorJson got called when it should not have').to.equal(0);
  });

  it('should honor the SFDX_JSON_TO_STDOUT on command errors', async () => {
    env.setBoolean('SFDX_JSON_TO_STDOUT', true);
    // Run the command
    class StdoutCommand extends SfdxCommand {
      public async run() {
        throw new Error('Ahhh!');
      }
    }
    const output = await StdoutCommand.run(['--json']);
    expect(output).to.equal(undefined);
    expect(process.exitCode).to.equal(1);

    const logJson = UX_OUTPUT['logJson'];
    expect(logJson.length, 'logJson did not get called with error json').to.equal(1);
    const json = ensureJsonMap(logJson[0]);
    expect(json.message, 'logJson did not get called with the right error').to.contains('Ahhh!');
    expect(UX_OUTPUT['errorJson'].length, 'errorJson got called when it should not have').to.equal(0);
  });

  it('should honor the SFDX_JSON_TO_STDOUT on command errors', async () => {
    env.setBoolean('SFDX_JSON_TO_STDOUT', false);
    // Run the command
    class StdoutCommand extends SfdxCommand {
      public async run() {
        throw new Error('Ahhh!');
      }
    }
    const output = await StdoutCommand.run(['--json']);
    expect(output).to.equal(undefined);
    expect(process.exitCode).to.equal(1);

    const logJson = UX_OUTPUT['errorJson'];
    expect(logJson.length, 'logJson did not get called with error json').to.equal(1);
    const json = ensureJsonMap(logJson[0]);
    expect(json.message, 'logJson did not get called with the right error').to.contains('Ahhh!');
    expect(UX_OUTPUT['logJson'].length, 'errorJson got called when it should not have').to.equal(0);
  });

  describe('deprecations', () => {
    class TestCommand extends BaseTestCommand {
      public static readonly deprecated = {
        message: "Don't use this junk no more, dig?",
        version: 41,
      };
      public static readonly flagsConfig: FlagsConfig = {
        foo: flags.boolean({
          description: 'crufty stuff',
          deprecated: {
            message: 'For the love of Mike, stop using this!',
            version: '41.0',
            to: 'bar',
          },
        }),
      };
      public async run() {
        return 'I ran!';
      }
    }

    it('should emit command and flag deprecation warnings', async () => {
      const output = await TestCommand.run(['--foo']);
      expect(output).to.equal('I ran!');
      expect(process.exitCode).to.equal(0);

      const commandWarning =
        'The command "TestCommand" has been deprecated and will be removed in v42.0 or later. Don\'t use this junk no more, dig?';
      expect(UX_OUTPUT.warn[0]).to.include(commandWarning);

      const flagWarning =
        'The flag "foo" has been deprecated and will be removed in v42.0 or later. Use "bar" instead. For the love of Mike, stop using this!';
      expect(UX_OUTPUT.warn[1]).to.include(flagWarning);
    });

    it('should collect command and flag deprecation warnings when outputting json', async () => {
      await TestCommand.run(['--foo', '--json']);
      expect(UX_OUTPUT.logJson[0]).to.deep.equal({
        status: 0,
        result: 'I ran!',
        warnings: [
          'The command "TestCommand" has been deprecated and will be removed in v42.0 or later. Don\'t use this junk no more, dig?',
          'The flag "foo" has been deprecated and will be removed in v42.0 or later. Use "bar" instead. For the love of Mike, stop using this!',
        ],
      });
    });
  });
});

describe('format', () => {
  class TestCommand extends BaseTestCommand {
    public format(error: SfdxError) {
      return this.formatError(error);
    }
  }

  it('should return expected base formatting', () => {
    // Set the mode to TEST
    $$.SANDBOX.stub(Global, 'getEnvironmentMode').returns(Mode.TEST);

    const message = "it's a trap!";
    const name = 'BadError';

    const sfdxError = new SfdxError(message, name);
    sfdxError.stack = 'stack for BadError';

    const expectedFormat = ['ERROR: ', message];

    const config = stubInterface<IConfig>($$.SANDBOX);
    expect(new TestCommand([], config).format(sfdxError)).to.deep.equal(expectedFormat);
  });

  it('should return expected formatting with a commandName set', () => {
    // Set the mode to TEST
    $$.SANDBOX.stub(Global, 'getEnvironmentMode').returns(Mode.TEST);

    const message = "it's a trap!";
    const name = 'BadError';
    const commandName = 'TestCommand1';

    const sfdxError = new SfdxError(message, name);
    sfdxError.stack = 'stack for BadError';
    sfdxError.setCommandName(commandName);

    const expectedFormat = [`ERROR running ${commandName}: `, message];

    const config = stubInterface<IConfig>($$.SANDBOX);
    expect(new TestCommand([], config).format(sfdxError)).to.deep.equal(expectedFormat);
  });

  it('should return expected formatting with actions', () => {
    // Set the mode to TEST
    $$.SANDBOX.stub(Global, 'getEnvironmentMode').returns(Mode.TEST);

    const message = "it's a trap!";
    const name = 'BadError';
    const actions = ['take action 1', 'take action 2'];

    const sfdxError = new SfdxError(message, name, actions);
    sfdxError.stack = 'stack for BadError';

    const expectedFormat = ['ERROR: ', message, '\n\nTry this:', `\n${actions[0]}`, `\n${actions[1]}`];

    const config = stubInterface<IConfig>($$.SANDBOX);
    expect(new TestCommand([], config).format(sfdxError)).to.deep.equal(expectedFormat);
  });

  it('should return expected formatting with stack trace (in dev mode)', () => {
    // Set the mode to DEVELOPMENT
    $$.SANDBOX.stub(Global, 'getEnvironmentMode').returns(Mode.DEVELOPMENT);

    const message = "it's a trap!";
    const name = 'BadError';

    const sfdxError = new SfdxError(message, name);
    sfdxError.stack = 'stack for BadError';

    const stackMsg = `\n*** Internal Diagnostic ***\n\n${sfdxError.stack}\n******\n`;
    const expectedFormat = ['ERROR: ', message, stackMsg];

    const config = stubInterface<IConfig>($$.SANDBOX);
    expect(new TestCommand([], config).format(sfdxError)).to.deep.equal(expectedFormat);
  });

  it('should return generate usage by default', () => {
    expect(TestCommand.usage).to.contain('[-f <string>]');
  });
});
