/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { stubMethod } from '@salesforce/ts-sinon';
import { AnyJson } from '@salesforce/ts-types';
import { expect } from 'chai';
import { createSandbox, SinonSandbox } from 'sinon';
import { DocOpts } from '../../src/docOpts';
import { SfdxCommand } from '../../src/sfdxCommand';
import { flags, FlagsConfig } from '../../src/sfdxFlags';

class TestCommand extends SfdxCommand {
  public async run(): Promise<AnyJson> {
    return {};
  }
}

describe('doc opts', () => {
  it('shows optional varargs', () => {
    class ItCommand extends TestCommand {
      public static varargs = true;
    }
    const usage = DocOpts.generate(ItCommand);
    // Only show once with right spacing
    expect(usage).to.contain('<%= command.id %> [name=value...] [--json]');
  });
  it('shows optional varargs object', () => {
    class ItCommand extends TestCommand {
      public static varargs = {
        required: false,
      };
    }
    const usage = DocOpts.generate(ItCommand);
    expect(usage).to.contain('<%= command.id %> [name=value...] [--json]');
  });
  it('shows required varargs', () => {
    class ItCommand extends TestCommand {
      public static varargs = {
        required: true,
      };
    }
    const usage = DocOpts.generate(ItCommand);
    expect(usage).to.contain('<%= command.id %> name=value... [--json]');
  });
  it('shows required string field', () => {
    class ItCommand extends TestCommand {
      public static flagsConfig: FlagsConfig = {
        testflag: flags.string({
          description: 'test',
          required: true,
          char: 'f',
        }),
      };
    }
    const usage = DocOpts.generate(ItCommand);
    expect(usage).to.contain(' -f <string>');
  });
  it('shows optional boolean field', () => {
    class ItCommand extends TestCommand {
      public static flagsConfig: FlagsConfig = {
        testflag: flags.boolean({
          description: 'test',
          char: 'f',
        }),
      };
    }
    const usage = DocOpts.generate(ItCommand);
    // boolean fields don't have a value
    expect(usage).to.contain(' [-f]');
  });
  it('shows array field', () => {
    class ItCommand extends TestCommand {
      public static flagsConfig: FlagsConfig = {
        testflag: flags.array({
          description: 'test',
          char: 'f',
        }),
      };
    }
    const usage = DocOpts.generate(ItCommand);
    // it would be nice to have <type>... and maybe even show a delimiter, but this is fine.
    expect(usage).to.contain(' [-f <array>]');
  });
  it('shows no short char', () => {
    class ItCommand extends TestCommand {
      public static flagsConfig: FlagsConfig = {
        testflag: flags.enum({
          description: 'test',
          options: ['a', 'b'],
        }),
      };
    }
    const usage = DocOpts.generate(ItCommand);
    expect(usage).to.contain(' [--testflag a|b]');
  });
  it('shows non-oclif type', () => {
    class ItCommand extends TestCommand {
      public static flagsConfig: FlagsConfig = {
        testflag: flags.url({
          description: 'test',
          char: 's',
        }),
      };
    }
    const usage = DocOpts.generate(ItCommand);
    expect(usage).to.contain(' [-s <url>]');
  });
  it('does not show hidden type', () => {
    class ItCommand extends TestCommand {
      public static flagsConfig: FlagsConfig = {
        testflag: flags.url({
          description: 'test',
          char: 's',
          hidden: true,
        }),
      };
    }
    const usage = DocOpts.generate(ItCommand);
    expect(usage).to.not.contain(' [-s <url>]');
  });
  it('shows standards fields last', () => {
    class ItCommand extends TestCommand {
      public static flagsConfig: FlagsConfig = {
        testflag: flags.url({
          description: 'test',
          char: 's',
        }),
      };
      public requiresusername = true;
    }
    const usage = DocOpts.generate(ItCommand);
    expect(usage).to.contain(
      ' [-s <url>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]'
    );
  });
  it('shows sometime fields in the middle', () => {
    class ItCommand extends TestCommand {
      public static flagsConfig: FlagsConfig = {
        testflag: flags.url({
          description: 'test',
          char: 's',
        }),
        quiet: flags.builtin({}),
      };
      public requiresusername = true;
    }
    const usage = DocOpts.generate(ItCommand);
    expect(usage).to.contain(
      ' [-s <url>] [--quiet] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]'
    );
  });

  // These could be obsolete based on if the skipped test ever work that way.
  it('shows optional one-way depended fields', () => {
    class ItCommand extends TestCommand {
      public static flagsConfig: FlagsConfig = {
        testflag: flags.url({
          description: 'test',
          char: 's',
        }),
        testflag2: flags.string({
          description: 'test',
          char: 'f',
          dependsOn: ['testflag'],
        }),
      };
    }
    const usage = DocOpts.generate(ItCommand);
    expect(usage).to.contain(' [-f <string> -s <url>]');
  });
  it('shows one-way depended field on required field', () => {
    class ItCommand extends TestCommand {
      public static flagsConfig: FlagsConfig = {
        testflag: flags.url({
          description: 'test',
          char: 's',
          required: true,
        }),
        testflag2: flags.string({
          description: 'test',
          char: 'f',
          dependsOn: ['testflag'],
        }),
      };
    }
    const usage = DocOpts.generate(ItCommand);
    // If a flag depends on a required flag, then it is optional.
    // So this should technically be "(-f <string> [-s <url>])" but
    // does that even make sense anymore since -f will always be there?
    // Maybe it should be just "-f <string> [-s <url>]""
    expect(usage).to.contain(' (-f <string> -s <url>)');
  });
  it('shows required one-way depended field on optional field', () => {
    class ItCommand extends TestCommand {
      public static flagsConfig: FlagsConfig = {
        testflag: flags.url({
          description: 'test',
          char: 's',
        }),
        testflag2: flags.string({
          description: 'test',
          char: 'f',
          required: true,
          dependsOn: ['testflag'],
        }),
      };
    }
    const usage = DocOpts.generate(ItCommand);
    // If the required flag depends on an optional, it isn't really optional.
    expect(usage).to.contain(' (-f <string> -s <url>)');
  });
  it('shows optional one-way exclusive fields', () => {
    class ItCommand extends TestCommand {
      public static flagsConfig: FlagsConfig = {
        testflag: flags.url({
          description: 'test',
          char: 's',
        }),
        testflag2: flags.string({
          description: 'test',
          char: 'f',
          exclusive: ['testflag'],
        }),
      };
    }
    const usage = DocOpts.generate(ItCommand);
    expect(usage).to.contain(' [-f <string> | -s <url>]');
  });
  it('shows one-way exclusive field on required field', () => {
    class ItCommand extends TestCommand {
      public static flagsConfig: FlagsConfig = {
        testflag: flags.url({
          description: 'test',
          char: 's',
          required: true,
        }),
        testflag2: flags.string({
          description: 'test',
          char: 'f',
          exclusive: ['testflag'],
        }),
      };
    }
    const usage = DocOpts.generate(ItCommand);
    expect(usage).to.contain(' (-f <string> | -s <url>)');
  });
  it('shows required one-way exclusive field on optional field', () => {
    class ItCommand extends TestCommand {
      public static flagsConfig: FlagsConfig = {
        testflag: flags.url({
          description: 'test',
          char: 's',
        }),
        testflag2: flags.string({
          description: 'test',
          char: 'f',
          required: true,
          exclusive: ['testflag'],
        }),
      };
    }
    const usage = DocOpts.generate(ItCommand);
    expect(usage).to.contain(' (-f <string> | -s <url>)');
  });

  it('shows option one-way exclusive field on optional field', () => {
    class ItCommand extends TestCommand {
      public static flagsConfig: FlagsConfig = {
        testflag: flags.url({
          description: 'test',
          char: 's',
        }),
        testflag2: flags.string({
          description: 'test',
          char: 'f',
          required: true,
          exclusive: ['testflag'],
        }),
      };
    }
    const usage = DocOpts.generate(ItCommand);
    expect(usage).to.contain(' (-f <string> | -s <url>)');
  });
  it('shows optional exclusive fields defined twice', () => {
    class ItCommand extends TestCommand {
      public static flagsConfig: FlagsConfig = {
        testflag: flags.url({
          description: 'test',
          char: 's',
          exclusive: ['testflag2'],
        }),
        testflag2: flags.string({
          description: 'test',
          char: 'f',
          exclusive: ['testflag'],
        }),
      };
    }
    const usage = DocOpts.generate(ItCommand);
    expect(usage).to.contain(' [-s <url> | -f <string>]');
  });
  it('shows optional two-way depended fields', () => {
    class ItCommand extends TestCommand {
      public static flagsConfig: FlagsConfig = {
        testflag: flags.url({
          description: 'test',
          char: 's',
          dependsOn: ['testflag2'],
        }),
        testflag2: flags.string({
          description: 'test',
          char: 'f',
          dependsOn: ['testflag'],
        }),
      };
    }
    const usage = DocOpts.generate(ItCommand);
    expect(usage).to.contain(' [-s <url> -f <string>]');
  });
  // Not implemented yet, but not sure if this is the functionality we want.
  it.skip('shows required one-way depended fields', () => {
    class ItCommand extends TestCommand {
      public static flagsConfig: FlagsConfig = {
        testflag: flags.url({
          description: 'test',
          char: 's',
          required: true,
        }),
        testflag2: flags.string({
          description: 'test',
          char: 'f',
          dependsOn: ['testflag'],
        }),
      };
    }
    const usage = DocOpts.generate(ItCommand);
    expect(usage).to.contain(' (-s <url> [-f <string>])');
  });
  it('shows required two-way depended fields', () => {
    class ItCommand extends TestCommand {
      public static flagsConfig: FlagsConfig = {
        testflag: flags.url({
          description: 'test',
          char: 's',
          required: true,
          dependsOn: ['testflag2'],
        }),
        testflag2: flags.string({
          description: 'test',
          char: 'f',
          required: true,
          dependsOn: ['testflag'],
        }),
      };
    }
    const usage = DocOpts.generate(ItCommand);
    expect(usage).to.contain(' (-s <url> -f <string>)');
  });
  describe('on error', () => {
    let sandbox: SinonSandbox;
    beforeEach(() => {
      sandbox = createSandbox();
    });
    afterEach(() => {
      sandbox.restore();
    });
    it('returns empty string', () => {
      stubMethod(sandbox, DocOpts.prototype, 'groupFlagElements').callsFake(() => {
        throw new Error('ahh');
      });
      class ItCommand extends TestCommand {
        public static flagsConfig: FlagsConfig = {
          testflag: flags.url({
            description: 'test',
            char: 's',
            required: true,
            dependsOn: ['testflag2'],
          }),
          testflag2: flags.string({
            description: 'test',
            char: 'f',
            required: true,
            dependsOn: ['testflag'],
          }),
        };
      }
      const usage = DocOpts.generate(ItCommand);
      expect(usage).to.equal('');
    });
  });
});
