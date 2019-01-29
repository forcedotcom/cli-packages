import { AnyJson } from '@salesforce/ts-types';
import { expect } from 'chai';
import { DocOpts } from '../../src/docOpts';
import { SfdxCommand } from '../../src/sfdxCommand';
import { flags, FlagsConfig } from '../../src/sfdxFlags';

class TestCommand extends SfdxCommand {
  public static flagsConfig: FlagsConfig = {
    testflag: flags.string({
      description: 'test',
      required: true,
      char: 'f'
    })
  };
  public async run(): Promise<AnyJson> {
    return {};
  }
}

describe('doc opts', () => {
  it('shows required field', () => {
    const usage = DocOpts.generate(TestCommand);
    // const topic = 'topic';
    // const command = 'foo';
    // const _require = () => ({
    //         commands: [{
    //             topic: `${topic}`,
    //             command: `${command}`,
    //             description: 'YADA YADA',
    //             longDescription: 'YADA YADA',
    //             help: 'YADA YADA',
    //             flags: [{
    //                 name: 'bar',
    //                 char: 'f',
    //                 description: 'YADA YADA',
    //                 longDescription: 'YADA YADA',
    //                 hasValue: true,
    //                 required: false,
    //                 type: 'string'
    //             }]
    //         }]
    //     });
    // const docCommandsListCommand = new DocCommandsListCommand(_require);
    // const result = docCommandsListCommand.cmds.filter(cmd => cmd.name === `${topic}:${command}`);
    // expect(result.length > 1).to.equal(true);
    expect(usage).to.contain(' [-f <string>]');
  });
});
