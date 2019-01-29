import { AnyArray, ensure, ensureArray, getArray, getString, has } from '@salesforce/ts-types';
import { definiteEntriesOf } from '@salesforce/ts-types';
import { SfdxCommand } from './sfdxCommand';
import { flags } from './sfdxFlags';

type FlagsType = Array<flags.Any<unknown> & { name: string }>;

/**
 * DocOpts generator.  See http://docopt.org/.
 *
 * flag.xor:   groups elements when one of the mutually exclusive cases is required: (--apple | --orange)
 * flag.or:    groups elements when none of the mutually exclusive cases is required: [--apple | --orange]
 * flag.and:   specifies that if one element is present, then another one is required: (--apple --orange)
 * flag.array: designates that argument to the left could be repeated one or more times
 * cmd.variableArgs: produces 'name=value'
 *
 * @example
 *  {
 *      name: 'classnames',
 *      ...
 *      xor: ['suitenames']
 *  },{
 *      name: 'suitenames',
 *      type: 'string',
 *      array: true
 *      ...
 *  }
 *
 *  Results in:
 *      Usage: sfdx force:apex:test:run (-n <string> | -s <string>...)
 *
 * @example
 *  {
 *      name: 'classnames',
 *      ...
 *      or: ['suitenames']
 *  },{
 *      name: 'suitenames',
 *      ...
 *  }
 *
 *  Results in:
 *      Usage: sfdx force:apex:test:run [-n <string> | -s <string>]
 *
 * @example
 *  {
 *      name: 'classnames',
 *      ...
 *      and: ['suitenames']
 *  },{
 *      name: 'suitenames',
 *      type: 'flag'
 *      ...
 *  }
 *
 *  Results in:
 *      Usage: sfdx force:apex:test:run (-n <string> -s )
 *
 * TODO:
 *  - Support nesting, eg:
 *      Usage: my_program (--either-this <and-that> | <or-this>)
 *      Usage: my_program [(<one-argument> <another-argument>)]
 *
 * @param cmdDef
 */
export class DocOpts<T extends typeof SfdxCommand> {
  public static generate<T extends typeof SfdxCommand>(cmdDef: T): string {
    return new DocOpts(cmdDef).toString();
  }

  private cmd: T;
  private flagList: FlagsType;

  public constructor(cmd: T) {
    this.cmd = cmd;
    this.flagList = definiteEntriesOf(this.cmd.flags).map(([k, v]) => {
      const { description, ...rest } = v;
      return { description: ensure(description), ...rest, name: k };
    });
  }

  public toString(): string {
    const requiredStrs: string[] = [];
    const optionalStrs: string[] = [];

    this.generateUsageElementGrouping('xor', '(', ')', true, requiredStrs);
    this.generateUsageElementGrouping('and', '(', ')', false, requiredStrs);
    this.generateUsageElementGrouping('or', '[', ']', true, optionalStrs);

    const requiredFlags = this.flagList.filter(flag => flag.required);
    this.generateUsageElement(requiredStrs, requiredFlags);

    const optionalFlags = this.flagList.filter(flag => !flag.required);
    this.generateUsageElement(optionalStrs, optionalFlags, '[', ']');

    const requiredStr = requiredStrs.length > 0 ? ` ${requiredStrs.join(' ')}` : '';
    const optionalStr = optionalStrs.length > 0 ? ` ${optionalStrs.join(' ')}` : '';
    const varargs = ''; // this.cmdDef.varargs ? ' name=value...' : ''
    return `<%= config.bin %> <%= command %> ${varargs}${requiredStr}${optionalStr}`;
  }

  private generateUsageElementGrouping(
    conditionalAttrName: string,
    beforeChar: string,
    afterChar: string,
    mutualExclusive: boolean,
    strs: string[]
  ) {
    const groupFlags = this.flagList.filter(flag => has(flag, 'conditionalAttrName'));
    groupFlags.forEach(conditionalFlag => {
      const conditionalStrs: string[] = [];
      this.generateUsageElement(conditionalStrs, [conditionalFlag]);

      const optionFlags: FlagsType = [];
      const nameList: AnyArray = ensureArray(getArray(conditionalFlag, 'conditionalAttrName'));

      for (const optionFlagName of nameList) {
        const optionFlag = this.flagList.find(flag => flag.name === optionFlagName);
        optionFlags.push(ensure(optionFlag));
      }

      for (const optionFlag of optionFlags) {
        // if (optionFlag.xor || optionFlag.or || optionFlag.and) {
        //     throw new Error(`Nested flag grouping not supported for ${conditionalAttrName}`);
        // }

        this.generateUsageElement(conditionalStrs, [optionFlag]);

        // remove flag from
        this.flagList = this.flagList.filter(flag => flag.name !== optionFlag.name);
      }

      const separator = mutualExclusive ? ' | ' : ' ';
      strs.push(`${beforeChar}${conditionalStrs.join(separator)}${afterChar}`);

      // remove 'or flags', handled here
      this.flagList = this.flagList.filter(flag => flag.name !== conditionalFlag.name);
    });

    return this.flagList;
  }

  private generateUsageElement(elementStrs: string[] = [], flagGroups: FlagsType, beforeChar = '', afterChar = '') {
    for (const flag of flagGroups) {
      // don't show usage for hidden flags
      if (!flag.hidden) {
        const kind = ensure(getString(flag, 'kind'));
        // not all flags have short names
        const flagName = flag.char ? `-${flag.char}` : `--${flag.name}`;
        const type = flag.type !== 'boolean' ? ` <${flag.type || 'string'}>${kind === 'array' ? '...' : ''}` : '';
        elementStrs.push(`${beforeChar}${flagName}${type}${afterChar}`);
      }
    }
  }
}