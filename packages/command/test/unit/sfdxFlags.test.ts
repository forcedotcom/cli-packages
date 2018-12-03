/*
 * Copyright (c) 2016, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { fail } from 'assert';
import { expect } from 'chai';

import { Messages } from '@salesforce/core';

import { buildSfdxFlags, flags } from '../../src/sfdxFlags';

Messages.importMessagesDirectory(__dirname);
const messages: Messages = Messages.loadMessages('@salesforce/command', 'flags');

describe('SfdxFlags', () => {
  const containsRequiredFlags = (rv: flags.Output) => {
    expect(rv.json).to.include({ type: 'boolean', kind: 'boolean' });
    expect(rv.loglevel).to.include({ optionType: 'enum', kind: 'enum' });
  };

  describe('buildSfdxFlags', () => {
    it('should always return json and loglevel flags', () => {
      const rv = buildSfdxFlags({}, {});
      expect(Object.keys(rv).length).to.equal(2);
      containsRequiredFlags(rv);
    });

    it('should add targetdevhubusername and apiversion', () => {
      const rv = buildSfdxFlags({}, { targetdevhubusername: true });
      expect(Object.keys(rv).length).to.equal(4);
      containsRequiredFlags(rv);
      expect(rv.targetdevhubusername).to.have.property(
        'description',
        messages.getMessage('targetdevhubusernameFlagDescription')
      );
      expect(rv.apiversion).to.have.property('description', messages.getMessage('apiversionFlagDescription'));
    });

    it('should add targetusername and apiversion', () => {
      const rv = buildSfdxFlags({}, { targetusername: true });
      expect(Object.keys(rv).length).to.equal(4);
      containsRequiredFlags(rv);
      expect(rv.targetusername).to.have.property('description', messages.getMessage('targetusernameFlagDescription'));
      expect(rv.apiversion).to.have.property('description', messages.getMessage('apiversionFlagDescription'));
    });

    it('should add builtin flags', () => {
      const rv = buildSfdxFlags(
        {
          concise: flags.builtin(),
          verbose: flags.builtin(),
          quiet: flags.builtin(),
          apiversion: flags.builtin()
        },
        {}
      );
      expect(Object.keys(rv).length).to.equal(6);
      containsRequiredFlags(rv);
      expect(rv.concise).to.have.property('description', messages.getMessage('conciseFlagDescription'));
      expect(rv.verbose).to.have.property('description', messages.getMessage('verboseFlagDescription'));
      expect(rv.quiet).to.have.property('description', messages.getMessage('quietFlagDescription'));
      expect(rv.apiversion).to.have.property('description', messages.getMessage('apiversionFlagDescription'));
    });

    it('should add oclif type flags', () => {
      const rv = buildSfdxFlags(
        {
          mybool: flags.boolean({ description: 'mybool desc' }),
          myhelp: flags.help({ description: 'myhelp desc' }),
          myinteger: flags.integer({ description: 'myinteger desc' }),
          mystring: flags.string({ description: 'mystring desc' }),
          myoption: flags.option({ description: 'myoption desc', parse: (i: string) => i }),
          myversion: flags.version({ description: 'myversion desc' })
        },
        {}
      );
      expect(Object.keys(rv).length).to.equal(8);
      containsRequiredFlags(rv);
      expect(rv.mybool).to.include({ description: 'mybool desc', kind: 'boolean' });
      expect(rv.myhelp).to.include({ description: 'myhelp desc', kind: 'help' });
      expect(rv.myinteger).to.include({ description: 'myinteger desc', kind: 'integer' });
      expect(rv.mystring).to.include({ description: 'mystring desc', kind: 'string' });
      expect(rv.myoption).to.include({ description: 'myoption desc', kind: 'option' });
      expect(rv.myversion).to.include({ description: 'myversion desc', kind: 'version' });
    });

    it('should add sfdx type flags', () => {
      const rv = buildSfdxFlags(
        {
          myarray: flags.array({ description: 'myarray desc' }),
          mydate: flags.date({ description: 'mydate desc' }),
          mydatetime: flags.datetime({ description: 'mydatetime desc' }),
          mydirectory: flags.directory({ description: 'mydirectory desc' }),
          myemail: flags.email({ description: 'myemail desc' }),
          myfilepath: flags.filepath({ description: 'myfilepath desc' }),
          myid: flags.id({ description: 'myid desc' }),
          mynumber: flags.number({ description: 'mynumber desc' }),
          myurl: flags.url({ description: 'myurl desc' })
        },
        {}
      );
      expect(Object.keys(rv).length).to.equal(11);
      containsRequiredFlags(rv);
      expect(rv.myarray).to.include({ description: 'myarray desc', kind: 'array' });
      expect(rv.mydate).to.include({ description: 'mydate desc', kind: 'date' });
      expect(rv.mydatetime).to.include({ description: 'mydatetime desc', kind: 'datetime' });
      expect(rv.mydirectory).to.include({ description: 'mydirectory desc', kind: 'directory' });
      expect(rv.myemail).to.include({ description: 'myemail desc', kind: 'email' });
      expect(rv.myfilepath).to.include({ description: 'myfilepath desc', kind: 'filepath' });
      expect(rv.myid).to.include({ description: 'myid desc', kind: 'id' });
      expect(rv.mynumber).to.include({ description: 'mynumber desc', kind: 'number' });
      expect(rv.mydate).to.include({ description: 'mydate desc', kind: 'date' });
      expect(rv.myurl).to.include({ description: 'myurl desc', kind: 'url' });
    });

    it('should throw for an unknown builtin flag', () => {
      try {
        buildSfdxFlags({ foo: flags.builtin() }, {});
        fail('referencing an unknown builtin flag should have failed.');
      } catch (e) {
        expect(e.name).to.equal('UnknownBuiltinFlagType');
      }
    });
  });

  describe('flags', () => {
    it('should echo back any builtin flag options', () => {
      const rv = flags.builtin();
      expect(rv).to.deep.equal({ type: 'builtin' });
    });
  });
});
