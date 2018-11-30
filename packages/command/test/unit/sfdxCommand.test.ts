/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { IConfig } from '@oclif/config';
import {
  ConfigAggregator,
  ConfigInfo,
  Global,
  LoggerLevel,
  Messages,
  Mode,
  Org,
  SfdxError,
  SfdxProject
} from '@salesforce/core';
import { testSetup } from '@salesforce/core/lib/testSetup';
import { cloneJson, isEmpty } from '@salesforce/kit';
import { stubInterface } from '@salesforce/ts-sinon';
import { Dictionary, ensureJsonMap, JsonArray, JsonMap, keysOf, Optional } from '@salesforce/ts-types';
import { fail } from 'assert';
import { expect } from 'chai';
import chalk from 'chalk';
import { join } from 'path';
import { SinonStub } from 'sinon';
import { SfdxCommand, SfdxResult } from '../../src/sfdxCommand';
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
    flag1: flags.string({ char: 'f', description: 'my desc' })
  };
  public static result: Dictionary;
  protected get statics(): typeof BaseTestCommand {
    return this.constructor as typeof BaseTestCommand;
  }

  public async run() {
    testCommandMeta = {
      cmdInstance: this,
      cmd: this.statics
    };
    return this.statics.output;
  }
}

// Props that should always be added to the test command constructor
const DEFAULT_CMD_PROPS = {
  flags: {
    json: { type: 'boolean' },
    loglevel: { type: 'option' }
  }
};

// Props that should always be added to the test command instance
const DEFAULT_INSTANCE_PROPS = {
  flags: {},
  args: {},
  isJson: false,
  logger: $$.TEST_LOGGER,
  configAggregator: { getInfo: (x: ConfigInfo) => ({ value: undefined }) },
  org: undefined,
  hubOrg: undefined,
  project: undefined
};

// Initial state of UX output by the command.
const UX_OUTPUT_BASE = {
  log: new Array<string[]>(),
  logJson: new Array<string[]>(),
  error: new Array<string[]>(),
  errorJson: new Array<string[]>(),
  table: new Array<string[]>(),
  warn: new Array<string[]>()
};

// Actual UX output by the command
let UX_OUTPUT: typeof UX_OUTPUT_BASE;
let configAggregatorCreate: SinonStub;

describe('SfdxCommand', () => {
  beforeEach(() => {
    process.exitCode = 0;

    UX_OUTPUT = cloneJson(UX_OUTPUT_BASE);
    configAggregatorCreate = $$.SANDBOX.stub(ConfigAggregator, 'create').returns(
      DEFAULT_INSTANCE_PROPS.configAggregator
    );

    $$.SANDBOX.stub(Global, 'getEnvironmentMode').returns({ is: () => false });

    // Stub all UX methods to update the UX_OUTPUT object
    $$.SANDBOX.stub(UX.prototype, 'log').callsFake((args: string[]) => UX_OUTPUT.log.push(args));
    $$.SANDBOX.stub(UX.prototype, 'logJson').callsFake((args: string[]) => UX_OUTPUT.logJson.push(args));
    $$.SANDBOX.stub(UX.prototype, 'error').callsFake((...args: string[]) => UX_OUTPUT.error.push(args));
    $$.SANDBOX.stub(UX.prototype, 'errorJson').callsFake((args: string[]) => UX_OUTPUT.errorJson.push(args));
    $$.SANDBOX.stub(UX.prototype, 'table').callsFake((args: string[]) => UX_OUTPUT.table.push(args));
    $$.SANDBOX.stub(UX.prototype, 'warn').callsFake((args: string[]) => UX_OUTPUT.warn.push(args));

    // Ensure BaseTestCommand['result'] is not defined before all tests
    BaseTestCommand.result = {};

    // Ensure BaseTestCommand.flagsConfig is returned to base state
    BaseTestCommand.flagsConfig = {
      flag1: flags.string({ char: 'f', description: 'my desc' })
    };
  });

  // tslint:disable-next-line:no-any
  function verifyCmdFlags(verifications: Dictionary<any>) {
    const merged = Object.assign({}, DEFAULT_CMD_PROPS.flags, verifications);
    const numOfFlagsMessage = 'Number of flag definitions for the command should match';
    expect(keysOf(testCommandMeta.cmd.flags).length, numOfFlagsMessage).to.equal(keysOf(merged).length);
    keysOf(merged).forEach(key => {
      expect(testCommandMeta.cmd.flags, `test for flag: ${key}`)
        .to.have.property(key)
        .and.include(merged[key]);
    });
  }

  function verifyInstanceProps(props: Dictionary = {}) {
    const merged = Object.assign({}, DEFAULT_INSTANCE_PROPS, props);
    keysOf(testCommandMeta.cmdInstance)
      .filter(key => !!merged[key])
      .forEach(key => {
        expect(testCommandMeta.cmdInstance[key], `test for instance prop: ${key}`).to.deep.equal(merged[key]);
      });

    expect(testCommandMeta.cmdInstance['ux']).to.be.ok.and.be.instanceof(UX);
  }

  function verifyUXOutput(output = {}) {
    const out = Object.assign({}, UX_OUTPUT_BASE, output);
    keysOf(out).forEach(key => {
      expect(UX_OUTPUT[key], `test UX output for ${key}()`).to.deep.equal(out[key]);
    });
  }

  it('should type this', () => {
    let result: JsonMap = {};
    const x: SfdxResult = {
      display(): void {
        result = ensureJsonMap(this.data);
      }
    };
    if (x.display) {
      x.display.call({ data: { foo: 'bar' } });
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
      tableColumnData: undefined
    };
    expect(testCommandMeta.cmdInstance['result']).to.include(expectedResult);
    verifyUXOutput();
  });

  it('should add SfdxCommand targetusername and apiversion flags with supportsUsername', async () => {
    const fakeOrg = 'fake_org';
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
      apiversion: { type: 'option' }
    });
    verifyInstanceProps({ org: fakeOrg });
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData: undefined
    };
    expect(testCommandMeta.cmdInstance['result']).to.include(expectedResult);
    verifyUXOutput();
  });

  it('should add SfdxCommand targetusername and apiversion flags with requiresUsername', async () => {
    const fakeOrg = 'fake_org';
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
      apiversion: { type: 'option' }
    });
    verifyInstanceProps({ org: fakeOrg });
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData: undefined
    };
    expect(testCommandMeta.cmdInstance['result']).to.include(expectedResult);
    verifyUXOutput();
  });

  it('should add SfdxCommand targetdevhubusername and apiversion flags with supportsDevhubUsername', async () => {
    const fakeOrg = 'fake_devhub_org';
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
      apiversion: { type: 'option' }
    });
    verifyInstanceProps({ hubOrg: fakeOrg });
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData: undefined
    };
    expect(testCommandMeta.cmdInstance['result']).to.include(expectedResult);
    verifyUXOutput();
  });

  it('should add SfdxCommand targetdevhubusername and apiversion flags with requiresDevhubUsername', async () => {
    const fakeOrg = 'fake_devhub_org';
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
      apiversion: { type: 'option' }
    });
    verifyInstanceProps({ hubOrg: fakeOrg });
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData: undefined
    };
    expect(testCommandMeta.cmdInstance['result']).to.include(expectedResult);
    verifyUXOutput();
  });

  it('should add a project when requiresProject is true', async () => {
    const fakeProject = 'fake_project';
    $$.SANDBOX.stub(SfdxProject, 'resolve')
      .withArgs()
      .returns(fakeProject);
    class TestCommand extends BaseTestCommand {}
    TestCommand['requiresProject'] = true;

    // Run the command
    const output = await TestCommand.run([]);

    expect(output).to.equal(TestCommand.output);
    expect(testCommandMeta.cmd.args, 'TestCommand.args should be undefined').to.equal(undefined);
    verifyCmdFlags({
      flag1: { type: 'option' }
    });
    verifyInstanceProps({ project: fakeProject });
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData: undefined
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
      verbose: { type: 'boolean' }
    });
    verifyInstanceProps();
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData: undefined
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
      flag1: { type: 'option' }
    });
    verifyInstanceProps({
      flags: { flag1: 'flag1_val' },
      args: { file: 'arg1_val' }
    });
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData: undefined
    };
    expect(testCommandMeta.cmdInstance['result']).to.include(expectedResult);
    verifyUXOutput();
  });

  it('should honor the -h flag to generate help output when the subclass does not define its own flag for -h', async () => {
    const lines: any[] = []; // tslint:disable-line no-any
    // Run the command
    class TestCommand extends BaseTestCommand {
      // tslint:disable-next-line no-any (matches oclif)
      public log(message?: any): void {
        if (message) {
          lines.push(message.toString());
        }
      }
    }
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
    const help = lines[0].slice(0, lines[0].indexOf('\n')).replace(/\u001b\[[0-9]+m/g, '');
    expect(help).to.equal('USAGE');
  });

  it('should honor the -h flag to generate help output, even when the subclass defines its own help flag', async () => {
    const lines: any[] = []; // tslint:disable-line no-any
    // Run the command
    class TestCommand extends BaseTestCommand {
      public static flagsConfig = {
        help: flags.help({ char: 'h' })
      };
      // tslint:disable-next-line no-any (matches oclif)
      public log(message?: any): void {
        if (message) {
          lines.push(message.toString());
        }
      }
    }
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
    const help = lines[0].slice(0, lines[0].indexOf('\n')).replace(/\u001b\[[0-9]+m/g, '');
    expect(help).to.equal('USAGE');
  });

  it('should not honor the -h flag to generate help output when used for another purpose by the subclass', async () => {
    const lines: any[] = []; // tslint:disable-line no-any
    // Run the command
    class TestCommand extends BaseTestCommand {
      public static flagsConfig = {
        foo: flags.boolean({ char: 'h', description: 'foo' })
      };
      // tslint:disable-next-line no-any (matches oclif)
      public log(message?: any): void {
        if (message) {
          lines.push(message.toString());
        }
      }
    }

    const output = await TestCommand.run(['-h']);

    expect(output).to.equal(TestCommand.output);
    expect(testCommandMeta.cmd.args, 'TestCommand.args should be undefined').to.equal(undefined);
    verifyInstanceProps({
      flags: { foo: true }
    });
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData: undefined
    };
    expect(testCommandMeta.cmdInstance['result']).to.include(expectedResult);
    verifyUXOutput();
  });

  it('should set this.isJson and only output ux.logJson with the --json flag', async () => {
    // Run the command
    class TestCommand extends BaseTestCommand {}
    const output = await TestCommand.run(['--json']);

    expect(output).to.equal(TestCommand.output);
    expect(testCommandMeta.cmd.args, 'TestCommand.args should be undefined').to.equal(undefined);
    verifyCmdFlags({ flag1: { type: 'option' } });
    verifyInstanceProps({
      flags: { json: true },
      isJson: true
    });
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData: undefined
    };
    expect(testCommandMeta.cmdInstance['result']).to.include(expectedResult);
    verifyUXOutput({ logJson: [{ status: 0, result: TestCommand.output }] });
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
      flags: { loglevel }
    });
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData: undefined
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
      { foo: 4000, bar: 'Guinness', baz: 0 }
    ];
    const output = await TestCommand.run([]);

    expect(output).to.equal(TestCommand.output);
    expect(testCommandMeta.cmd.args, 'TestCommand.args should be undefined').to.equal(undefined);
    verifyCmdFlags({ flag1: { type: 'option' } });
    verifyInstanceProps();
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData
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
      tableColumnData
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
      { foo: 4000, bar: 'Guinness', baz: 0 }
    ];
    const output = await TestCommand.run([]);

    expect(output).to.equal(TestCommand.output);
    expect(testCommandMeta.cmd.args, 'TestCommand.args should be undefined').to.equal(undefined);
    verifyCmdFlags({ flag1: { type: 'option' } });
    verifyInstanceProps();
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData
    };
    expect(testCommandMeta.cmdInstance['result']).to.deep.include(expectedResult);
    verifyUXOutput({ table: [TestCommand.output] });
  });

  it('should override result display with result.display prop', async () => {
    // Run the command
    class TestCommand extends BaseTestCommand {}
    // tslint:disable-next-line:no-any
    TestCommand['result']['display'] = function(this: { data: any; ux: UX }) {
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
      tableColumnData: undefined
    };
    expect(testCommandMeta.cmdInstance['result']).to.deep.include(expectedResult);
    verifyUXOutput({ log: [`CUSTOM: ${TestCommand.output}`] });
  });

  it('should warn when apiVersion is being overridden via config', async () => {
    const apiVersion = '42.0';
    const configAggregator = {
      getInfo: (x: ConfigInfo) => ({ value: apiVersion })
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
      tableColumnData: undefined
    };
    expect(testCommandMeta.cmdInstance['result']).to.include(expectedResult);
    verifyUXOutput({
      warn: [`apiVersion configuration overridden at ${apiVersion}`]
    });
  });

  it('should NOT warn when apiVersion is overridden via a flag', async () => {
    const apiVersion = '42.0';
    const configAggregator = {
      getInfo: (x: ConfigInfo) => ({ value: apiVersion })
    };
    configAggregatorCreate.restore();
    configAggregatorCreate = $$.SANDBOX.stub(ConfigAggregator, 'create').returns(configAggregator);
    const fakeOrg = 'fake_org';
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
      apiversion: { type: 'option' }
    });
    verifyInstanceProps({
      configAggregator,
      org: fakeOrg,
      flags: { apiversion: apiversionFlagVal }
    });
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData: undefined
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
      error: [['ERROR running TestCommand: ', 'This command is required to run from within an SFDX project.']]
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
          'This command requires a scratch org username set either with a flag or by default in the config.'
        ]
      ]
    });
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
      apiversion: { type: 'option' }
    });
    verifyInstanceProps();
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData: undefined
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
          'This command requires a dev hub org username set either with a flag or by default in the config.'
        ]
      ]
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
      apiversion: { type: 'option' }
    });
    verifyInstanceProps();
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData: undefined
    };
    expect(testCommandMeta.cmdInstance['result']).to.include(expectedResult);
    verifyUXOutput();
  });

  it('should only output to ux.errorJson when isJson is true and an error occurs', async () => {
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
      errorJson: [
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
          warnings: UX.warnings
        }
      ]
    });
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
        foo: 'bar'
      });
    });

    it('should be added to the command instance when varargs are required', async () => {
      class TestCommand extends BaseTestCommand {}
      TestCommand['varargs'] = { required: true };
      await TestCommand.run(['-f', 'blah', 'foo=bar and this', 'username=me@my.org']);
      expect(testCommandMeta.cmdInstance).to.have.deep.property('varargs', {
        foo: 'bar and this',
        username: 'me@my.org'
      });
    });

    it('should be added to the command instance when varargs pass validation', async () => {
      class TestCommand extends BaseTestCommand {}
      TestCommand['varargs'] = { required: false, validator };
      const cmdArgs = [{ name: 'file' }];
      TestCommand['args'] = cmdArgs;
      await TestCommand.run(['myFile.json', '-f', 'blah', 'foo=bar']);
      expect(testCommandMeta.cmdInstance).to.have.deep.property('varargs', {
        foo: 'bar'
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
            'Provide required name=value pairs for the command. Enclose any values that contain spaces in double quotes.'
          ]
        ]
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
            'Setting variables must be in the format <key>=<value> or <key>="<value with spaces>" but found foobar.'
          ]
        ]
      });
    });

    it('should throw when duplicate varargs are provided', async () => {
      class TestCommand extends BaseTestCommand {}
      TestCommand['varargs'] = { required: false, validator };
      await TestCommand.run(['-f', 'blah', 'foo=bar', 'foo=that']);
      expect(process.exitCode).to.equal(1);
      verifyUXOutput({
        error: [['ERROR running TestCommand: ', "Cannot set variable name 'foo' twice for the same command."]]
      });
    });

    it('should throw when varargs do not pass validation', async () => {
      class TestCommand extends BaseTestCommand {}
      TestCommand['varargs'] = { required: false, validator };
      await TestCommand.run(['-f', 'blah', 'foo=']);
      expect(process.exitCode).to.equal(1);
      verifyUXOutput({
        error: [['ERROR running TestCommand: ', 'Vararg [foo] must not be empty.']]
      });
    });
  });

  describe('SfdxFlags Custom Attributes', () => {
    const ERR_NEXT_STEPS: Dictionary<string> = {
      date: ` ${messages.getMessage('FormattingMessageDate')}`,
      datetime: ` ${messages.getMessage('FormattingMessageDate')}`,
      id: ` ${messages.getMessage('FormattingMessageId')}`,
      url: ` ${messages.getMessage('FormattingMessageUrl')}`
    };

    async function validateFlag(flagType: keyof typeof flags, val: string, err: boolean) {
      const create = flags[flagType];
      class TestCommand extends BaseTestCommand {
        public static flagsConfig = {
          // @ts-ignore TODO: why isn't `create` invokable?!
          doflag: create({ char: 'i', description: 'my desc' })
        };
      }
      const output = await TestCommand.run(['--doflag', val]);
      if (err) {
        const sfdxError = SfdxError.create('@salesforce/command', 'flags', 'InvalidFlagTypeError', [
          val,
          TestCommand.flagsConfig.doflag.kind,
          ERR_NEXT_STEPS[flagType] || ''
        ]);
        expect(output).to.equal(undefined);
        expect(process.exitCode).to.equal(1);
        verifyUXOutput({
          error: [['ERROR running TestCommand: ', sfdxError.message]]
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

    it('should validate time flag type for an invalid time', async () => {
      return validateFlag('time', '100:100:100', true);
    });

    it('should validate time flag type for a correct time', async () => {
      return validateFlag('time', '01:02:20', false);
    });

    // tslint:disable-next-line:no-any
    function validateFlagAttributes(output: any, errName: string, flagName: string) {
      const sfdxError = SfdxError.create('@salesforce/command', 'flags', errName, [flagName]);
      expect(output).to.equal(undefined);
      expect(process.exitCode).to.equal(1);
      verifyUXOutput({
        error: [['ERROR running TestCommand: ', sfdxError.message]]
      });
    }

    it('should validate longDescription is string', async () => {
      class TestCommand extends BaseTestCommand {}
      TestCommand.flagsConfig = {
        myflag: flags.string({
          char: 'm',
          // @ts-ignore ignore invalid longDescription value
          longDescription: false,
          description: 'my desc'
        })
      };

      const output = await TestCommand.run(['--myflag', 'input']);
      validateFlagAttributes(output, 'InvalidLongDescriptionFormat', 'myflag');
    });

    it('should validate description is defined', async () => {
      class TestCommand extends BaseTestCommand {}
      TestCommand.flagsConfig = {
        // @ts-ignore ignore error about not providing description
        myflag: flags.string({ char: 'm' })
      };
      const output = await TestCommand.run(['--myflag', 'input']);
      validateFlagAttributes(output, 'MissingOrInvalidFlagDescription', 'myflag');
    });

    it('should validate char length is one', async () => {
      class TestCommand extends BaseTestCommand {}
      TestCommand.flagsConfig = {
        myflag: flags.string({
          // @ts-ignore ignore invalid char value length
          char: 'foo',
          description: 'bar'
        })
      };
      const output = await TestCommand.run(['--myflag', 'input']);
      validateFlagAttributes(output, 'InvalidFlagChar', 'myflag');
    });

    it('should validate char is alphabetical', async () => {
      class TestCommand extends BaseTestCommand {}
      TestCommand.flagsConfig = {
        // @ts-ignore ignore invalid char value
        myflag: flags.string({ char: '5', description: 'bar' })
      };
      const output = await TestCommand.run(['--myflag', 'input']);
      validateFlagAttributes(output, 'InvalidFlagChar', 'myflag');
    });

    it('should validate flag name is all lowercase', async () => {
      class TestCommand extends BaseTestCommand {}
      TestCommand.flagsConfig = {
        myFlag: {
          char: 'm',
          description: 'foobar'
        }
      };
      const output = await TestCommand.run(['--myFlag', 'input']);
      validateFlagAttributes(output, 'InvalidFlagName', 'myFlag');
    });

    it('should validate flag name is all lowercase for oclif type flags', async () => {
      class TestCommand extends BaseTestCommand {}
      TestCommand.flagsConfig = {
        myFlag: flags.boolean({
          char: 'm',
          description: 'foobar'
        })
      };
      const output = await TestCommand.run(['--myFlag', 'input']);
      validateFlagAttributes(output, 'InvalidFlagName', 'myFlag');
    });

    it('should validate that undefined is not a valid flag type value', async () => {
      class TestCommand extends BaseTestCommand {}
      TestCommand.flagsConfig = {
        myflag: flags.number({
          char: 'm',
          description: 'my desc'
        })
      };
      // @ts-ignore Allow undefined array value against the compiler spec to test underlying engine
      const output = await TestCommand.run(['--myflag', undefined]);
      expect(output).to.equal(undefined);
      expect(process.exitCode).to.equal(1);
      verifyUXOutput({
        error: [['ERROR running TestCommand: ', 'Flag --myflag expects a value']]
      });
    });
  });

  describe('flags', () => {
    it('should support all possible flag types', async () => {
      // tslint:disable-next-line:no-any
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
          array: flags.array({ description: 'woot' }),
          intarray: flags.array({ description: 'woot' }, v => parseInt(v, 10)),
          date: flags.date({ description: 'date' }),
          datetime: flags.datetime({ description: 'datetime' }),
          directory: flags.directory({ description: 'directory' }),
          email: flags.email({ description: 'some email' }),
          filepath: flags.filepath({ description: 'filepath' }),
          id: flags.id({ description: 'id' }),
          number: flags.number({ description: 'number' }),
          time: flags.time({ description: 'time' }),
          url: flags.url({ description: 'url' }),

          // builtins
          apiversion: flags.builtin(),
          concise: flags.builtin(),
          quiet: flags.builtin(),
          verbose: flags.builtin()
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
        '--integer=10',
        '--option=o',
        '--string=s',
        // '--version', // TODO: figure out why this exits

        // sfdx
        '--array=1,2,3',
        '--intarray=1,2,3',
        '--date=01-02-2000',
        '--datetime=01/02/2000 01:02:34',
        '--email=bill@thecat.org',

        // builtins
        '--apiversion=42.0',
        '--concise',
        '--quiet',
        '--verbose',
        '--targetdevhubusername=foo',
        '--targetusername=bar'
      ]);

      expect(inputs.boolean).to.be.true;
      expect(inputs.enum).to.equal('e');
      expect(inputs.integer).to.equal(10);
      expect(inputs.option).to.equal('O');
      expect(inputs.string).to.equal('s');

      expect(inputs.array).to.deep.equal(['1', '2', '3']);
      expect(inputs.intarray).to.deep.equal([1, 2, 3]);
      expect(inputs.date.toISOString()).to.equal('2000-01-02T07:00:00.000Z');
      expect(inputs.datetime.toISOString()).to.equal('2000-01-02T08:02:34.000Z');
      expect(inputs.email).to.equal('bill@thecat.org');

      expect(inputs.apiversion).to.equal('42.0');
      expect(inputs.concise).to.be.true;
      expect(inputs.verbose).to.be.true;
      expect(inputs.targetdevhubusername).to.equal('foo');
      expect(inputs.targetusername).to.equal('bar');
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
});
