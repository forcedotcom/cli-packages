import { Dictionary, ensure, ensureArray, getString, isArray, isBoolean, isPlainObject } from '@salesforce/ts-types';
import { definiteEntriesOf } from '@salesforce/ts-types';
import { get } from '@salesforce/ts-types';
import { SfdxCommand } from './sfdxCommand';
import { flags, optionalBuiltinFlags, requiredBuiltinFlags } from './sfdxFlags';

type FlagType = flags.Any<unknown> & { name: string };
type FlagsType = FlagType[];

/**
 * DocOpts generator for SfdxCommands.  See http://docopt.org/.
 *
 * flag.exclusive: groups elements when one of the mutually exclusive cases is a required flag: (--apple | --orange)
 * flag.exclusive: groups elements when none of the mutually exclusive cases is required (optional flags): [--apple | --orange]
 * flag.dependsOn: specifies that if one element is present, then another one is required: (--apple --orange)
 * cmd.variableArgs: produces 'name=value'
 *
 * @example
 *  {
 *      name: 'classnames',
 *      required: true,
 *      exclusive: ['suitenames']
 *      ...
 *  },{
 *      name: 'suitenames',
 *      type: 'array'
 *      required: true
 *      ...
 *  }
 *
 *  Results in:
 *      Usage: <%= command.id %> (-n <string> | -s <array>)
 *
 * @example
 *  {
 *      name: 'classnames',
 *      ...
 *      excludes: ['suitenames']
 *  },{
 *      name: 'suitenames',
 *      ...
 *  }
 *
 *  Results in:
 *      Usage: <%= command.id %> [-n <string> | -s <string>]
 *
 * @example
 *  {
 *      name: 'classnames',
 *      ...
 *      dependsOn: ['suitenames']
 *  },{
 *      name: 'suitenames',
 *      type: 'flag'
 *      ...
 *  }
 *
 *  Results in:
 *      Usage: <%= command.id %> (-n <string> -s)
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
  private flags: Dictionary<FlagType>;
  private flagList: FlagsType;

  public constructor(cmd: T) {
    this.cmd = cmd;
    // Create a new map with references to the flags that we can manipulate.
    this.flags = {};
    this.flagList = definiteEntriesOf(this.cmd.flags).map(([k, v]) => {
      const { description, ...rest } = v;
      const flag = { description: ensure(description), ...rest, name: k };
      this.flags[k] = flag;
      return flag;
    });
  }

  public toString(): string {
    const groups = Object.values(this.groupFlagElements());
    // Protected field
    const varargs = this.cmd.getVarArgsConfig();
    let varargsElement = '';

    if (varargs) {
      varargsElement = 'name=value...';
      const isRequired = isPlainObject(varargs) && varargs.required;
      if (!isRequired) {
        varargsElement = `[${varargsElement}]`;
      }
      varargsElement = `${varargsElement} `;
    }

    return `<%= command.id %> ${varargsElement}${groups.join(' ')}`;
  }

  /**
   * Group flags that dependOn (and) and are exclusive (or).
   */
  private groupFlagElements() {
    const groups = this.categorizeFlags();
    const elementMap: Dictionary<string> = {};

    // Generate all doc opt elements for combining
    this.generateElements(elementMap, groups.requiredFlags);
    this.generateElements(elementMap, groups.optionalFlags);
    this.generateElements(elementMap, groups.sometimesBuiltinFlags);
    this.generateElements(elementMap, groups.alwaysBuiltinFlags);

    for (const flag of this.flagList) {
      if (isArray(flag.dependsOn)) {
        this.combineElementsToFlag(elementMap, flag.name, flag.dependsOn, ' ');
      }

      if (isArray(flag.exclusive)) {
        this.combineElementsToFlag(elementMap, flag.name, flag.exclusive, ' | ');
      }
    }

    // Since combineElementsToFlag deletes the references in this.flags when it combines
    // them, this will go through the remaining list of uncombined elements.
    for (const remainingFlagName of Object.keys(this.flags)) {
      const remainingFlag = ensure(this.flags[remainingFlagName]);

      if (!remainingFlag.required) {
        elementMap[remainingFlag.name] = `[${elementMap[remainingFlag.name]}]`;
      }
    }
    return elementMap;
  }

  /**
   * Combine doc opt elements to another flag's doc opt element. This is for supporting
   * things like "and" (dependsOn) and "or" (exclusive).
   *
   * This will probably break down on complex dependsOn / exclusive flag structures.
   * For example, a flag that depends on a flag that depends on another flag.
   *
   * See tests to see what is supported.
   * @param elementMap All doc opt elements.
   * @param flagName The name of the flag to combine to.
   * @param flagNames The other flag names to combine to flagName.
   * @param unionString How to combine the doc opt elements.
   */
  private combineElementsToFlag(
    elementMap: Dictionary<string>,
    flagName: string,
    flagNames: string[],
    unionString: string
  ) {
    let isRequired = ensure(this.flags[flagName]).required;
    if (!isBoolean(isRequired) || !isRequired) {
      isRequired = flagNames.reduce(
        (required, toCombine) => required || (this.cmd.flags[toCombine].required || false),
        false
      );
    }

    for (const toCombine of flagNames) {
      elementMap[flagName] = `${elementMap[flagName]}${unionString}${elementMap[toCombine]}`;
      // We handled this flag, don't handle it again
      delete elementMap[toCombine];
      delete this.flags[toCombine];
    }
    if (isRequired) {
      elementMap[flagName] = `(${elementMap[flagName]})`;
    } else {
      elementMap[flagName] = `[${elementMap[flagName]}]`;
    }
    // We handled this flag, don't handle it again
    delete this.flags[flagName];
  }

  /**
   * Categorize flags into required, optional, builtin opt-in, and mandatory builtin
   * flags. This is the order they should appear in the doc opts.
   *
   * For example, flags defined on the actual command should some before standard
   * fields like --json.
   */
  private categorizeFlags() {
    const alwaysBuiltinFlags = [];
    const alwaysBuiltinFlagKeys = Object.keys(requiredBuiltinFlags);
    const sometimesBuiltinFlags = [];
    const sometimesBuiltinFlagKeys = Object.keys(optionalBuiltinFlags);
    const requiredFlags = [];
    const optionalFlags = [];

    // We should also group on depends (AND, OR)
    for (const flag of this.flagList) {
      if (alwaysBuiltinFlagKeys.find(key => key === flag.name)) {
        alwaysBuiltinFlags.push(flag);
      } else if (sometimesBuiltinFlagKeys.find(key => key === flag.name)) {
        sometimesBuiltinFlags.push(flag);
      } else if (flag.required) {
        requiredFlags.push(flag);
      } else {
        optionalFlags.push(flag);
      }
    }

    return {
      requiredFlags,
      optionalFlags,
      sometimesBuiltinFlags,
      alwaysBuiltinFlags
    };
  }

  /**
   * Generate doc opt elements for all flags.
   * @param elementMap The map to add the elements to.
   * @param flagGroups The flags to generate elements for.
   */
  private generateElements(elementMap: Dictionary<string> = {}, flagGroups: FlagsType) {
    const elementStrs = [];
    for (const flag of flagGroups) {
      const kind = ensure(getString(flag, 'kind'));
      // not all flags have short names
      const flagName = flag.char ? `-${flag.char}` : `--${flag.name}`;
      let type = '';
      if (kind !== 'boolean') {
        if (kind === 'enum') {
          const options = ensureArray(get(flag, 'options'));
          type = ` ${options.join('|')}`;
        } else {
          type = ` <${kind || 'string'}>`;
        }
      }
      const element = `${flagName}${type}`;
      elementMap[flag.name] = element;
      elementStrs.push(element);
    }
    return elementStrs;
  }
}
