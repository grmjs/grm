export const LAYER = 143;

import { Api } from "./api.js";

// deno-lint-ignore no-explicit-any
const tlObjects: any = {};

for (const tl of Object.values(Api)) {
  if ("CONSTRUCTOR_ID" in tl) {
    tlObjects[tl.CONSTRUCTOR_ID] = tl;
  } else {
    for (const sub of Object.values(tl)) {
      tlObjects[sub.CONSTRUCTOR_ID] = sub;
    }
  }
}

export { tlObjects };
