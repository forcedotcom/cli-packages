/*
 * Copyright (c) 2016, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { fail } from 'assert';
import { expect } from 'chai';

import { Messages, SfdxError } from '@salesforce/core';

import { Duration } from '@salesforce/kit';
import { hasFunction } from '@salesforce/ts-types';
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

    it('should throw for numeric flags with values out of bounds', () => {
      const integer = flags.integer({ description: 'integer', min: 2, max: 4 });
      const milliseconds = flags.milliseconds({ description: 'milliseconds', min: 2, max: 4 });
      const minutes = flags.minutes({ description: 'minutes', min: 2, max: 4 });
      const number = flags.number({ description: 'number', min: 2, max: 4 });
      const seconds = flags.seconds({ description: 'seconds', min: 2, max: 4 });

      if (!hasFunction(integer, 'parse')) throw new Error('missing parse method for integer');
      expect(integer.parse('3')).to.equal(3);
      expect(() => integer.parse('1')).to.throw(
        SfdxError,
        'Expected integer greater than or equal to 2 but received 1'
      );
      expect(() => integer.parse('5')).to.throw(SfdxError, 'Expected integer less than or equal to 4 but received 5');

      if (!hasFunction(milliseconds, 'parse')) throw new Error('missing parse method for milliseconds');
      expect(milliseconds.parse('2')).to.deep.equal(Duration.milliseconds(2));
      expect(() => milliseconds.parse('1')).to.throw(
        SfdxError,
        'Expected milliseconds greater than or equal to 2 but received 1'
      );
      expect(() => milliseconds.parse('5')).to.throw(
        SfdxError,
        'Expected milliseconds less than or equal to 4 but received 5'
      );

      if (!hasFunction(minutes, 'parse')) throw new Error('missing parse method for minutes');
      expect(minutes.parse('4')).to.deep.equal(Duration.minutes(4));
      expect(() => minutes.parse('1')).to.throw(
        SfdxError,
        'Expected minutes greater than or equal to 2 but received 1'
      );
      expect(() => minutes.parse('5')).to.throw(SfdxError, 'Expected minutes less than or equal to 4 but received 5');

      if (!hasFunction(number, 'parse')) throw new Error('missing parse method for number');
      expect(number.parse('2.5')).to.equal(2.5);
      expect(() => number.parse('1.5')).to.throw(
        SfdxError,
        'Expected number greater than or equal to 2 but received 1.5'
      );
      expect(() => number.parse('4.5')).to.throw(SfdxError, 'Expected number less than or equal to 4 but received 4.5');

      if (!hasFunction(seconds, 'parse')) throw new Error('missing parse method for seconds');
      expect(seconds.parse('3')).to.deep.equal(Duration.seconds(3));
      expect(() => seconds.parse('1')).to.throw(
        SfdxError,
        'Expected seconds greater than or equal to 2 but received 1'
      );
      expect(() => seconds.parse('5')).to.throw(SfdxError, 'Expected seconds less than or equal to 4 but received 5');
    });
  });

  describe('flags', () => {
    it('should echo back any builtin flag options', () => {
      const rv = flags.builtin();
      expect(rv).to.deep.equal({ type: 'builtin' });
    });
  });
});
