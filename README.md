# Grm [![deno module](https://shield.deno.dev/x/grm)](https://deno.land/x/grm)

> MTProto client for Deno ported from [GramJS](https://github.com/gram-js/gramjs).

## Documentation

Currently, there is no documentation dedicated to Grm.
You can use the GramJS documentation and API reference.

- <https://gram.js.org>
- <https://painor.gitbook.io/gramjs>
- <https://gram.js.org/beta>

## Quick Start

Here you'll learn how to obtain necessary information to initialize the client, authorize your personal account and send yourself a message.

First, you'll need to obtain an API ID and hash:

1. Visit [my.telegram.org](https://my.telegram.org) and sign in.
2. Click "API development tools" and fill your application details (only the app title and the short name are required).
3. Click "Create application".

> Don't leak your API credentials.
> They can't be revoked.

Then use your API credentials with the following example code:

```ts
import { StringSession, TelegramClient } from "https://deno.land/x/grm/mod.ts";

const appId = 123456;
const appHash = "abcd1234";

// Fill in this later with the value from `client.session.save()`,
// so that you don't have to login every time.
const stringSession = new StringSession("");

console.log("Loading interactive example...");
const client = new TelegramClient(stringSession, appId, appHash);

await client.start({
  phoneNumber: () => prompt("Pone number:")!,
  password: () => prompt("Password:")!,
  phoneCode: () => prompt("Verification code:")!,
  onError: console.error,
});

console.log("Connected.");
console.log(client.session.save());

// Send yourself a message.
await client.sendMessage("me", { message: "Hello, world!" });
```

You'll be prompted to enter your phone number (in international format), the
code you received from Telegram, and your 2FA password if you have one set.

You can then save output of `client.session.save()` and use it in `new StringSession("here")` to not login again each time.

After connecting successfully, you should have a text message saying "Hello, world!" in
your Saved Messages.

Check out [examples/](examples/) for more examples.

## Used by

Here are some awesome projects powered by Grm:

- [xorgram/xor](https://github.com/xorgram/xor)

Add yours to this list by opening a pull request.

## Contributing

Feel free to open pull requests related to improvements and fixes to the core library and documentation.
We are currently following API changes in the original GramJS repository applying them here.

We'd appreciate if you could help with migrating from Node.js modules such as
[socks](https://github.com/JoshGlazebrook/socks) and
[websocket](https://github.com/theturtle32/WebSocket-Node) to Deno APIs.

## Credits

This port wouldn't exist without these wonderful people. Thanks to

- the original
  [authors and contributors](https://github.com/gram-js/gramjs/graphs/contributors)
  of GramJS,
- authors of the dependencies,
- authors of the already ported dependencies,
- [contributors](https://github.com/dcdunkan/grm/graphs/contributors) of this
  repository,
- and everyone else who were a part of this.

---

## Notes

This is a _direct_ port of GramJS for Deno.
This was just an attempt, which turned out to be a successful one.
Most of the commonly used features are working as expected.

It took me like 4 days; a total of 20h6m for this repository alone.
Including dependency porting and reading the original code, it is a total of almost
34.8h for the first release.
I didn't just copy and paste stuff — I did, but I
manually wrote lot of the files.
It made me realize how much effort have been put into the development of [GramJS](https://github.com/gram-js/gramjs).
You should definitely give it a star if you're using this library.

I had to port the following Node.js modules to Deno:

- [JoshGlazebrook/socks](https://github.com/JoshGlazebrook/socks) —
  [deno_socks](https://github.com/dcdunkan/deno_socks)
- [indutny/node-ip](https://github.com/indutny/node-ip) —
  [deno_ip](https://github.com/dcdunkan/deno_ip)
- [JoshGlazebrook/smart-buffer](https://github.com/JoshGlazebrook/smart-buffer)
  — [deno_smart_buffer](https://github.com/dcdunkan/deno_smart_buffer)
- [spalt08/cryptography](https://github.com/spalt08/cryptography) —
  [deno_cryptography](https://github.com/dcdunkan/deno_cryptography)

> I know that some of them should not have been ported, but I didn't realized that then.
