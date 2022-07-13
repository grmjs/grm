// deno-lint-ignore-file no-explicit-any
import { crc32 } from "../helpers.ts";
import { DateLike } from "../define.d.ts";
import { Buffer } from "deps.ts";

export const CORE_TYPES = new Set([
  0xbc799737, // boolFalse#bc799737 = Bool;
  0x997275b5, // boolTrue#997275b5 = Bool;
  0x3fedd339, // true#3fedd339 = True;
  0xc4b9f9bb, // error#c4b9f9bb code:int text:string = Error;
  0x56730bcc, // null#56730bcc = Null;
]);

const AUTH_KEY_TYPES = new Set([
  0x05162463, // resPQ,
  0x83c95aec, // p_q_inner_data
  0xa9f55f95, // p_q_inner_data_dc
  0x3c6a84d4, // p_q_inner_data_temp
  0x56fddf88, // p_q_inner_data_temp_dc
  0xd0e8075c, // server_DH_params_ok
  0xb5890dba, // server_DH_inner_data
  0x6643b654, // client_DH_inner_data
  0xd712e4be, // req_DH_params
  0xf5045f1f, // set_client_DH_params
  0x3072cfa1, // gzip_packed
]);

export function findAll(
  regex: RegExp,
  str: string,
  matches: string[][] = [],
) {
  if (!regex.flags.includes("g")) {
    regex = new RegExp(regex.source, "g");
  }

  const res = regex.exec(str);
  if (res) {
    matches.push(res.slice(1));
    findAll(regex, str, matches);
  }

  return matches;
}

export interface ArgConfig {
  isVector: boolean;
  isFlag: boolean;
  skipConstructorId: boolean;
  flagIndex: number;
  flagIndicator: boolean;
  type: string | null;
  useVectorId: boolean | null;
  name?: string;
}

export function buildArgConfig(name: string, argType: string) {
  name = name === "self" ? "is_self" : name;
  const currentConfig: ArgConfig = {
    isVector: false,
    isFlag: false,
    skipConstructorId: false,
    flagIndex: -1,
    flagIndicator: true,
    type: null,
    useVectorId: null,
  };

  const _canBeInferred = name === "random_id";

  if (argType !== "#") {
    currentConfig.flagIndicator = false;
    currentConfig.type = argType.replace(/^!+/, "");

    const flagMatch = currentConfig.type.match(
      /flags(\d+)?.(\d+)\?([\w<>.]+)/,
    );
    if (flagMatch) {
      currentConfig.isFlag = true;
      currentConfig.flagIndex = Number(flagMatch[1] ?? flagMatch[2]);
      [, , , currentConfig.type] = flagMatch;
    }

    const vectorMatch = currentConfig.type.match(/[Vv]ector<([\w\d.]+)>/);
    if (vectorMatch) {
      currentConfig.isVector = true;
      currentConfig.useVectorId = currentConfig.type.charAt(0) === "V";
      [, currentConfig.type] = vectorMatch;
    }

    if (/^[a-z]$/.test(currentConfig.type.split(".").pop()?.charAt(0)!)) {
      currentConfig.skipConstructorId = true;
    }
  }

  if (currentConfig.type === "future_salt") {
    currentConfig.type = "FutureSalt";
  }

  return currentConfig;
}

export interface Config {
  name: string;
  constructorId: number;
  argsConfig: Record<string, ArgConfig>;
  subclassOfId: number;
  result: string;
  isFunction: boolean;
  namespace?: string;
}

export function fromLine(line: string, isFunction: boolean) {
  const match = line.match(
    /([\w.]+)(?:#([0-9a-fA-F]+))?(?:\s{?\w+:[\w\d<>#.?!]+}?)*\s=\s([\w\d<>#.?]+);$/,
  );
  if (!match) {
    // Probably "vector#1cb5c415 {t:Type} # [ t ] = Vector t;"
    throw new Error(`Cannot parse TLObject ${line}`);
  }

  const argsMatch = findAll(/({)?(\w+):([\w\d<>#.?!]+)}?/, line);
  const currentConfig: Config = {
    name: match[1],
    constructorId: parseInt(match[2], 16),
    argsConfig: {},
    subclassOfId: crc32(match[3]),
    result: match[3],
    isFunction: isFunction,
  };

  if (!currentConfig.constructorId) {
    const hexId = "";
    let args: string;

    if (Object.values(currentConfig.argsConfig).length) {
      args = ` ${
        Object
          .keys(currentConfig.argsConfig)
          .map((arg) => arg.toString())
          .join(" ")
      }`;
    } else {
      args = "";
    }

    const representation =
      `${currentConfig.name}${hexId}${args} = ${currentConfig.result}`
        .replace(/(:|\?)bytes /g, "$1string ")
        .replace(/</g, " ")
        .replace(/>|{|}/g, "")
        .replace(/ \w+:flags(\d+)?\.\d+\?true/g, "");

    // WHY?
    if (currentConfig.name === "inputMediaInvoice") {
      // eslint-disable-next-line no-empty
      if (currentConfig.name === "inputMediaInvoice") {
        //
      }
    }

    currentConfig.constructorId = crc32(Buffer.from(representation, "utf8"));
  }

  for (const [brace, name, argType] of argsMatch) {
    if (brace === undefined) {
      currentConfig.argsConfig[
        variableSnakeToCamelCase(name)
      ] = buildArgConfig(name, argType);
    }
  }

  if (currentConfig.name.includes(".")) {
    [currentConfig.namespace, currentConfig.name] = currentConfig.name.split(
      /\.(.+)/,
    );
  }

  currentConfig.name = snakeToCamelCase(currentConfig.name);

  return currentConfig;
}

export function* parseTl(
  content: string,
  _layer: string,
  methods: any[] = [],
  ignoreIds = CORE_TYPES,
) {
  const _methodInfo = (methods || []).reduce(
    (o, m) => ({ ...o, [m.name]: m }),
    {},
  );
  const objAll = new Array<Config>();
  const objByName: Record<string, Config> = {};
  const objByType: Record<string, Array<Config>> = {};

  const file = content;
  let isFunction = false;

  for (let line of file.split("\n")) {
    const commentIndex = line.indexOf("//");
    if (commentIndex !== -1) {
      line = line.slice(0, commentIndex);
    }

    line = line.trim();
    if (!line) continue;

    const match = line.match(/---(\w+)---/);
    if (match) {
      const [, followingTypes] = match;
      isFunction = followingTypes === "functions";
      continue;
    }

    try {
      const result = fromLine(line, isFunction);

      if (ignoreIds.has(result.constructorId)) continue;

      objAll.push(result);

      if (!result.isFunction) {
        if (!objByType[result.result]) {
          objByType[result.result] = [];
        }

        objByName[result.name] = result;
        objByType[result.result].push(result);
      }
    } catch (e) {
      if (!e.toString().includes("vector#1cb5c415")) {
        throw e;
      }
    }
  }

  for (const obj of objAll) {
    if (AUTH_KEY_TYPES.has(obj.constructorId)) {
      for (const arg in obj.argsConfig) {
        if (obj.argsConfig[arg].type === "string") {
          obj.argsConfig[arg].type = "bytes";
        }
      }
    }
  }

  for (const obj of objAll) {
    yield obj;
  }
}

export function snakeToCamelCase(name: string) {
  const result = name.replace(/(?:^|_)([a-z])/g, (_, g) => g.toUpperCase());
  return result.replace(/_/g, "");
}

export function variableSnakeToCamelCase(name: string) {
  return name.replace(
    /([-_][a-z])/g,
    (group) => group.toUpperCase().replace("-", "").replace("_", ""),
  );
}

export function serializeBytes(data: Buffer | string | any) {
  if (!(data instanceof Buffer)) {
    if (typeof data === "string") {
      data = Buffer.from(data);
    } else {
      throw Error(`Bytes or str expected, not ${data.constructor.name}`);
    }
  }

  const r = new Array<Buffer>();
  let padding: number;

  if (data.length < 254) {
    padding = (data.length + 1) % 4;
    if (padding !== 0) padding = 4 - padding;
    r.push(Buffer.from([data.length]));
    r.push(data);
  } else {
    padding = data.length % 4;
    if (padding !== 0) padding = 4 - padding;
    r.push(
      Buffer.from([
        254,
        data.length % 256,
        (data.length >> 8) % 256,
        (data.length >> 16) % 256,
      ]),
    );
    r.push(data);
  }

  r.push(Buffer.alloc(padding).fill(0));
  return Buffer.concat(r);
}

export function serializeDate(date: DateLike | Date) {
  if (!date) {
    return Buffer.alloc(4).fill(0);
  }

  if (date instanceof Date) {
    date = Math.floor((Date.now() - date.getTime()) / 1000);
  }

  if (typeof date === "number") {
    const t = Buffer.alloc(4);
    t.writeInt32LE(date, 0);
    return t;
  }

  throw Error(`Cannot interpret "${date}" as a date`);
}
