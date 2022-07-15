// deno-lint-ignore-file no-explicit-any
import { ArgConfig, Config } from "../generation_helpers.ts";

const WEIRD_TYPES = new Set(["Bool", "X", "Type"]);

function groupByKey(collection: Array<any>, key: string) {
  return collection.reduce((byKey, member) => {
    const keyValue = member[key] || "_";

    if (!byKey[keyValue]) {
      byKey[keyValue] = [member];
    } else {
      byKey[keyValue].push(member);
    }

    return byKey;
  }, {});
}

function getClassNameWithNameSpace(name: string, namespace: string) {
  return namespace
    ? namespace.toLowerCase() + "." + upperFirst(name)
    : upperFirst(name);
}

function renderTypeName(typeName: string) {
  return typeName.includes(".")
    ? typeName.replace(".", ".Type")
    : `Api.Type${typeName}`;
}

function upperFirst(str: string) {
  return `${str[0].toUpperCase()}${str.slice(1)}`;
}

function _lowerFirst(str: string) {
  return `${str[0].toLowerCase()}${str.slice(1)}`;
}

function renderTypes(types: Array<any>, indent: string) {
  return types.map(({ name, constructors }) => {
    return `${!constructors.length ? "// " : ""}export type Type\
${upperFirst(name)} = ${constructors.map((name: any) => name).join(" | ")};`
      .trim();
  }).join(`\n${indent}`);
}

function renderValueType(type: string, isVector: boolean, isTlType: boolean) {
  if (WEIRD_TYPES.has(type)) {
    return type;
  }

  let resType;

  if (typeof type === "string" && isTlType) {
    resType = renderTypeName(type);
  } else {
    resType = type;
  }
  if (resType === "true") {
    resType = "boolean";
  }
  if (isVector) {
    resType = `${resType}[]`;
  }

  return resType;
}

function renderArg(argName: string, argConfig: ArgConfig) {
  const { isVector, isFlag, skipConstructorId, type } = argConfig;

  const valueType = renderValueType(type!, isVector, !skipConstructorId);
  return `${argName === "flags" ? "// " : ""}${argName}${
    isFlag || (argName === "randomId" && type === "long" && !isVector)
      ? "?"
      : ""
  }: ${valueType}`;
}

function renderConstructors(constructors: Array<Config>, indent: string) {
  return constructors
    .map((args) => {
      // console.log(args);
      const {
        name,
        namespace,
        argsConfig,
        constructorId,
        subclassOfId,
      } = args;
      if (name === "Message") {
        return `export class Message extends CustomMessage {
${indent}CONSTRUCTOR_ID: ${constructorId};
${indent}SUBCLASS_OF_ID: ${subclassOfId};
${indent}classType: "request";
${indent}className: "${getClassNameWithNameSpace(name, namespace!)}";
${indent}static fromReader(reader: Reader): ${upperFirst(name)};
}`;
      } else if (name === "MessageService") {
        return `export class MessageService extends CustomMessage {
${indent}CONSTRUCTOR_ID: ${constructorId};
${indent}SUBCLASS_OF_ID: ${subclassOfId};
${indent}classType: "request";
${indent}className: "${getClassNameWithNameSpace(name, namespace!)}";
${indent}static fromReader(reader: Reader): ${upperFirst(name)};
}`;
      }
      const argKeys = Object.keys(argsConfig);
      // console.log(constructorId);
      if (!argKeys.length) {
        return `export class ${
          upperFirst(
            name,
          )
        } extends VirtualClass<void> {
${indent}CONSTRUCTOR_ID: ${constructorId};
${indent}SUBCLASS_OF_ID: ${subclassOfId};
${indent}classType: "constructor";
${indent}className: "${getClassNameWithNameSpace(name, namespace!)}";
${indent}static fromReader(reader: Reader): ${upperFirst(name)};
}`;
      }

      const hasRequiredArgs = argKeys.some(
        (argName) => argName !== "flags" && !argsConfig[argName].isFlag,
      );

      return `
export class ${upperFirst(name)} extends VirtualClass<{
${indent}  ${
        Object.keys(argsConfig)
          .map((argName) =>
            `
  ${renderArg(argName, argsConfig[argName])};
`.trim()
          )
          .join(`\n${indent}  `)
      }
${indent}}${!hasRequiredArgs ? "" : ""}> {
${indent}CONSTRUCTOR_ID: ${constructorId};
${indent}SUBCLASS_OF_ID: ${subclassOfId};
${indent}classType: "constructor";
${indent}className: "${getClassNameWithNameSpace(name, namespace!)}";
${indent}static fromReader(reader: Reader): ${upperFirst(name)};
${indent}  ${
        Object.keys(argsConfig)
          .map((argName) =>
            `
  ${renderArg(argName, argsConfig[argName])};
`.trim()
          )
          .join(`\n${indent}  `)
      }
${indent}}`.trim();
    })
    .join(`\n${indent}`);
}

function renderResult(result: string) {
  const vectorMatch = result.match(/[Vv]ector<([\w\d.]+)>/);
  const isVector = Boolean(vectorMatch);
  const scalarValue = isVector && vectorMatch ? vectorMatch[1] : result;
  const isTlType = Boolean(scalarValue.match(/^[A-Z]/)) ||
    scalarValue.includes(".");

  return renderValueType(scalarValue, isVector, isTlType);
}

function renderRequests(requests: Array<Config>, indent: string) {
  return requests
    .map((args) => {
      const {
        name,
        argsConfig,
        result,
        constructorId,
        namespace,
        subclassOfId,
      } = args;
      const argKeys = Object.keys(argsConfig);

      if (!argKeys.length) {
        return `export class ${
          upperFirst(
            name,
          )
        } extends Request<void, ${renderResult(result)}> {
${indent}CONSTRUCTOR_ID: ${constructorId};
${indent}SUBCLASS_OF_ID: ${subclassOfId};
${indent}classType: "request";
${indent}className: "${getClassNameWithNameSpace(name, namespace!)}";
${indent}static fromReader(reader: Reader): ${upperFirst(name)};
}`;
      }

      const hasRequiredArgs = argKeys.some(
        (argName) => argName !== "flags" && !argsConfig[argName].isFlag,
      );

      return `
export class ${upperFirst(name)} extends Request<Partial<{
${indent}  ${
        argKeys
          .map((argName) =>
            `
  ${renderArg(argName, argsConfig[argName])};
`.trim()
          )
          .join(`\n${indent}  `)
      }
${indent}}${!hasRequiredArgs ? "" : ""}>, ${renderResult(result)}> {
${indent}CONSTRUCTOR_ID: ${constructorId};
${indent}SUBCLASS_OF_ID: ${subclassOfId};
${indent}classType: "request";
${indent}className: "${getClassNameWithNameSpace(name, namespace!)}";
${indent}static fromReader(reader: Reader): ${upperFirst(name)};
${indent}  ${
        argKeys
          .map((argName) =>
            `

  ${renderArg(argName, argsConfig[argName])};
`.trim()
          )
          .join(`\n${indent}  `)
      }
${indent}}`.trim();
    })
    .join(`\n${indent}`);
}

export function template({ types, constructors, functions }: {
  types: {
    namespace?: string | undefined;
    name: string;
    constructors: Array<string>;
  }[];
  constructors: Array<Config>;
  functions: Array<Config>;
}) {
  const typesByNs = groupByKey(types, "namespace");
  const constructorsByNs = groupByKey(constructors, "namespace");
  const requestsByNs = groupByKey(functions, "namespace");

  return `// This file is autogenerated. All changes will be overwritten.
import { EntityLike, MessageIDLike } from "../define.d.ts";
import { CustomMessage } from "./custom/message.ts";
import { TelegramClient } from "../client/telegram_client.ts";
import { BinaryReader } from "../extensions/binary_reader.ts"
import { bigInt, Buffer } from "../../deps.ts";;

export namespace Api {
  // deno-lint-ignore no-explicit-any
  type AnyLiteral = Record<string, any> | void;
  type Reader = BinaryReader;
  type Client = TelegramClient;
  // deno-lint-ignore no-explicit-any
  type Utils = any; // To be defined.
  type X = unknown;
  type Type = unknown;
  type Bool = boolean;
  type int = number;
  type double = number;
  type float = number;
  type int128 = bigInt.BigInteger;
  type int256 = bigInt.BigInteger;
  type long = bigInt.BigInteger;
  type bytes = Buffer;
  class VirtualClass<Args extends AnyLiteral> {
    static CONSTRUCTOR_ID: number;
    static SUBCLASS_OF_ID: number;
    static className: string;
    static classType: 'constructor' | 'request';
    static serializeBytes(data: Buffer | string): Buffer;
    static serializeDate(date: Date | number): Buffer;
    getBytes():Buffer;
    CONSTRUCTOR_ID: number;
    SUBCLASS_OF_ID: number;
    className: string;
    classType: 'constructor' | 'request';
    constructor(args: Args);
    originalArgs: Args;
    toJSON(): Args;
  }
  class Request<Args, Response> extends VirtualClass<Partial<Args>> {
    static readResult(reader: Reader): Buffer;
    resolve(client: Client, utils: Utils): Promise<void>;
    __response: Response;
  }
  ${renderConstructors(constructorsByNs._, "  ")}
  ${renderRequests(requestsByNs._, "  ")}
// namespaces
  ${
    Object.keys(constructorsByNs)
      .map((namespace) =>
        namespace !== "_"
          ? `
  export namespace ${namespace} {
    ${renderConstructors(constructorsByNs[namespace], "    ")}
  }`
          : ""
      )
      .join("\n")
  }
  ${
    Object.keys(typesByNs)
      .map((namespace) =>
        namespace !== "_"
          ? `
  export namespace ${namespace} {
    ${renderTypes(typesByNs[namespace], "    ")}
  }`
          : ""
      )
      .join("\n")
  }
  ${
    Object.keys(requestsByNs)
      .map((namespace) =>
        namespace !== "_"
          ? `
  export namespace ${namespace} {
    ${renderRequests(requestsByNs[namespace], "    ")}
  }`
          : ""
      )
      .join("\n")
  }
// Types
  export type TypeEntityLike = EntityLike;
  ${renderTypes(typesByNs._, "  ")}
// All requests
  export type AnyRequest = ${
    requestsByNs._.map(({ name }: any) => upperFirst(name)).join(" | ")
  }
    | ${
    Object.keys(requestsByNs)
      .filter((ns) => ns !== "_")
      .map((ns) =>
        requestsByNs[ns]
          .map(({ name }: any) => `${ns}.${upperFirst(name)}`)
          .join(" | ")
      )
      .join("\n    | ")
  };
}
`;
}
