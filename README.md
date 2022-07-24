> **Warning**
>
> Considered as unstable. But, most of the commonly used features are working as
> expected.

<div align="center">

# Grm

[![deno module](https://shield.deno.dev/x/grm)](https://deno.land/x/grm)

</div>

Grm is an improved Deno port of [GramJS](https://github.com/gram-js/gramjs),
written in TypeScript. GramJS is a popular MTProto API Telegram client library
written in JavaScript for Node.js and browsers, with its core being based on
[Telethon](https://github.com/LonamiWebs/Telethon).

Deno Land module: https://deno.land/x/grm

> What is Deno? https://deno.land

## Documentation

Consider following the documentation by GramJS maintainers.

- https://gram.js.org
- https://painor.gitbook.io/gramjs
- https://gram.js.org/beta

See the [Quick Start](#quick-start) section for a minimal example to get
started.

## Quick Start

Here you'll learn how to obtain necessary information to create a Telegram
application, authorize into your account and send yourself a message.

First, you'll need to obtain an API ID and hash:

1. Login into your [Telegram account](https://my.telegram.org).
2. Then click "API development tools" and fill your application details (only
   app title and short name are required).
3. Finally, click "Create application".

> **Warning**
>
> Never share any API/authorization details, that will compromise your
> application and account.

When you've successfully created the application, replace the API ID and hash
you got from Telegram in the following code.

`main.ts`

```ts
import { StringSession, TelegramClient } from "https://deno.land/x/grm/mod.ts";

// Login and create an application on https://my.telegram.org
// to get values for API ID and API Hash.
const apiId = 123456;
const apiHash = "abcd1234";

// Fill in this later with the value from `client.session.save()`,
// so you don't have to login each time you run the file.
const stringSession = new StringSession("");

console.log("Loading interactive example...");
const client = new TelegramClient(stringSession, apiId, apiHash);

await client.start({
  phoneNumber: () => prompt("Enter your phone number:")!,
  password: () => prompt("Enter your password:")!,
  phoneCode: () => prompt("Enter the code you received:")!,
  onError: (err) => console.log(err),
});

console.log("You should now be connected.");
// Save the output of the following and use it in `new SessionString("")`
// to avoid logging in again next time.
console.log(client.session.save());

// Send a message to yourself
await client.sendMessage("me", { message: "Hello, World!" });
```

Lets run it:

```bash
deno run -A main.ts
```

You'll be prompted to enter your phone number (in international format), and the
code you received from Telegram. Save the output of `client.session.save()`
somewhere and use it in `new StringSession("")` to avoid logging again later.
After connecting successfully, you should have a text message saying "Hello" in
your Saved Messages.

Check out the [examples/](examples/) directory for more examples.

## Used by

Here is a list of cool projects that uses Grm.

- [xorgram/xor](https://github.com/xorgram/xor) — Telegram user bot focusing on
  uniqueness and extensibility.

Feel free to add yours to this list by opening a pull request.

## Contributing

Feel free to open pull requests related to improvements and fixes to the core
library and documentation. We are currently following API changes in GramJS core
library and applying them here.

We'd appreciate if you could help with...

- Migrating from using Node modules such as
  [socks](https://github.com/JoshGlazebrook/socks) and
  [websocket](https://github.com/theturtle32/WebSocket-Node) to using Deno's
  built-in websocket support.

## Credits

This port wouldn't exist without these wonderful people. Thanks to

- the original
  [authors and contributors](https://github.com/gram-js/gramjs/graphs/contributors)
  of GramJS,
- authors of the dependencies,
- authors of already ported dependencies,
- [contributors](https://github.com/dcdunkan/grm/graphs/contributors) of this
  repository,
- and everyone else who were a part of this.

---

## Notes

This is a _direct_ port of GramJS for Deno. This was just an attempt, which
turned out to be a successful one. Most of the commonly used features are
confirmed as working as expected.

It took me like 4 days; a total of 20h6m for this repository alone. Including
dependency porting and figuring out the original code, its a total of almost
34.8h for the first release. I didn't just copy and paste stuff — I did, but I
manually wrote lot of the files. It made me realize how much effort have been
put into the development of [GramJS](https://github.com/gram-js/gramjs). You
should definitely give it a star on GitHub, if you're using this library.

I had to port the following Node modules to Deno. I know that some of them is
not even have to be ported, but I didn't realized that then.

- [JoshGlazebrook/socks](https://github.com/JoshGlazebrook/socks) —
  [deno_socks](https://github.com/dcdunkan/deno_socks)
- [indutny/node-ip](https://github.com/indutny/node-ip) —
  [deno_ip](https://github.com/dcdunkan/deno_ip)
- [JoshGlazebrook/smart-buffer](https://github.com/JoshGlazebrook/smart-buffer)
  — [deno_smart_buffer](https://github.com/dcdunkan/deno_smart_buffer)
- [spalt08/cryptography](https://github.com/spalt08/cryptography) —
  [deno_cryptography](https://github.com/dcdunkan/deno_cryptography)

<br>

<h3 align="center">🦕</h3>
