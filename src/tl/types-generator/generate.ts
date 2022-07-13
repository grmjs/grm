import { template } from "./template.ts";
import { Config, parseTl } from "../generation_helpers.ts";
import { dirname, fromFileUrl, resolve } from "deps";

const DIR_PATH = dirname(fromFileUrl(import.meta.url));
const INPUT_FILE = resolve(DIR_PATH, "../static/api.tl");
const SCHEMA_FILE = resolve(DIR_PATH, "../static/schema.tl");
const OUTPUT_FILE = resolve(DIR_PATH, "../api.d.ts");

const peersToPatch = [
  "InputPeer",
  "Peer",
  "InputUser",
  "User",
  "UserFull",
  "Chat",
  "ChatFull",
  "InputChannel",
];

function patchMethods(methods: Array<Config>) {
  for (const method of methods) {
    for (const arg in method["argsConfig"]) {
      if (peersToPatch.includes(method.argsConfig[arg].type!)) {
        method.argsConfig[arg].type = "EntityLike";
      } else if (
        method.argsConfig[arg].type &&
        arg.toLowerCase().includes("msgid")
      ) {
        if (method.argsConfig[arg].type !== "long") {
          method.argsConfig[arg].type = "MessageIDLike";
        }
      }
    }
  }
}

function extractParams(fileContent: string) {
  const defIterator = parseTl(fileContent, "109");
  const types: Record<
    string,
    { namespace?: string; name: string; constructors: Array<string> }
  > = {};
  const constructors = new Array<Config>();
  const functions = new Array<Config>();

  for (const def of defIterator) {
    if (def.isFunction) {
      functions.push(def);
      continue;
    }

    if (!types[def.result]) {
      const [namespace, name] = def.result.includes(".")
        ? def.result.split(".")
        : [undefined, def.result];

      types[def.result] = {
        namespace,
        name,
        constructors: [],
      };
    }

    types[def.result].constructors.push(
      def.namespace ? `${def.namespace}.${def.name}` : def.name,
    );
    constructors.push(def);
  }

  return {
    types: Object.values(types),
    constructors,
    functions,
  };
}

function generateTypes() {
  const tlContent = Deno.readTextFileSync(INPUT_FILE);
  const apiConfig = extractParams(tlContent);

  const schemaContent = Deno.readTextFileSync(SCHEMA_FILE);
  const schemaConfig = extractParams(schemaContent);

  const types = [...apiConfig.types, ...schemaConfig.types];
  const functions = [...apiConfig.functions, ...schemaConfig.functions];
  const constructors = [
    ...apiConfig.constructors,
    ...schemaConfig.constructors,
  ];

  // Patching custom types
  patchMethods(functions);
  const generated = template({
    constructors,
    functions,
    types,
  });

  Deno.writeTextFileSync(OUTPUT_FILE, generated);
}

generateTypes();
