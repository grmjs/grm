// deno-lint-ignore-file no-explicit-any
import { Api } from "./api.js";
import { CustomMessage } from "./custom/message.ts";

function getGetter(obj: any, prop: string) {
  while (obj) {
    const getter = Object.getOwnPropertyDescriptor(obj, prop);
    if (getter && getter.get) {
      return getter.get;
    }
    obj = Object.getPrototypeOf(obj);
  }
}

function getSetter(obj: any, prop: string) {
  while (obj) {
    const getter = Object.getOwnPropertyDescriptor(obj, prop);
    if (getter && getter.set) {
      return getter.set;
    }
    obj = Object.getPrototypeOf(obj);
  }
}

function getInstanceMethods(obj: any) {
  const keys = {
    methods: new Set<string>(),
    setters: new Set<string>(),
    getters: new Set<string>(),
  };
  const topObject = obj;

  const mapAllMethods = (property: string) => {
    const getter = getGetter(topObject, property);
    const setter = getSetter(topObject, property);
    if (getter) {
      keys["getters"].add(property);
    } else if (setter) {
      keys["setters"].add(property);
    } else {
      if (!(property == "constructor")) {
        keys["methods"].add(property);
      }
    }
  };

  do {
    Object.getOwnPropertyNames(obj).map(mapAllMethods);
    obj = Object.getPrototypeOf(obj);
  } while (obj && Object.getPrototypeOf(obj));

  return keys;
}

// deno-lint-ignore ban-types
function patchClass(clazz: Function) {
  const { getters, setters, methods } = getInstanceMethods(
    CustomMessage.prototype,
  );
  for (const getter of getters) {
    Object.defineProperty(clazz.prototype, getter, {
      get: getGetter(CustomMessage.prototype, getter),
    });
  }
  for (const setter of setters) {
    Object.defineProperty(clazz.prototype, setter, {
      set: getSetter(CustomMessage.prototype, setter),
    });
  }
  for (const method of methods) {
    clazz.prototype[method] = (CustomMessage.prototype as any)[method];
  }
}

export function patchAll() {
  patchClass(Api.Message);
  patchClass(Api.MessageService);
}
