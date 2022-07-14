> **Warning**: Considered as unstable. I haven't tested everything yet, so I'm
> not entirely sure.

# GramJS for Deno

[GramJS](https://github.com/gram-js/gramjs) is a popular Telegram client written
in JavaScript for Node.js and browsers, with its core being based on
[Telethon](https://github.com/LonamiWebs/Telethon).

This is a port of **GramJS for Deno**, written in TypeScript.

Deno Land module: https://deno.land/x/grm

> What is Deno? https://deno.land

## Documentation

Consider following the original documentation by original GramJS maintainers.

- https://gram.js.org/
- https://painor.gitbook.io/gramjs

See the [Quick Start](#quick-start) section, for a minimal example.

## Quick Start

Here you'll learn how to obtain necessary information to create Telegram
application, authorize into your account and send yourself a message.

First, you'll need to obtain an API ID and hash:

1. Login into your [Telegram account](https://my.telegram.org)
2. Then click "API development tools" and fill your application details (only
   app title and short name are required)
3. Finally, click "Create application"

> **Warning**: Never share any API/authorization details, that will compromise
> your application and account.

When you've successfully created the application, set the API ID and hash you
just got from Telegram in the following code.

```ts
import { StringSession, TelegramClient } from "https://deno.land/x/grm/mod.ts";

// Login and create an application on https://my.telegram.org
// to get values for API ID and API Hash.
const apiId = 123456;
const apiHash = "abcd1234";

// Fill in this later with the value from client.session.save(),
// so you don't have to login each time you run the file.
const stringSession = new StringSession("");

console.log("Loading interactive example...");
const client = new TelegramClient(stringSession, apiId, apiHash, {
  connectionRetries: 5,
});

await client.start({
  phoneNumber: () => prompt("Enter your phone number:")!,
  password: async () => await prompt("Enter your password:")!,
  phoneCode: async () => await prompt("Enter the code you received:")!,
  onError: (err) => console.log(err),
});

console.log("You should now be connected.");
// Save the output of the following and use it in `new SessionString("")`
// to avoid logging in again next time.
console.log(client.session.save());

// Send a message to yourself
await client.sendMessage("me", { message: "Hello!" });
```

Lets run it:

```bash
deno run -A file-name.ts
```

You'll be prompted to enter your phone number (in international format), and the
code you received from Telegram. Save the output of `client.session.save()`
somewhere and use it in `new StringSession("")` to avoid logging again later.
After connecting successfully, you should have a "Hello" message in your Saved
Messages.

## Notes

This is a _direct_ port of GramJS for Deno. This was just an attempt, which
turned out to be a successful one. At least, the startup, the getting started
example, and file uploading and downloading works. And I'm happy about it. And I
don't know if this works for you or not, but it works for me :)

It took me like 4 days. Total of 20h6m for this repository alone. And including
dependency porting and figuring out the original code, its a total of almost
34.8h for the first release. I didn't just copy and paste stuff — I did, but I
manually wrote lot of the files.

I haven't added any JSDocs yet. I'll add them later. I didn't add any because
its a mess if there are a lot of comments while porting (We can just collapse
them, I know. But my machine can't take too much load, its an old one).

I had to port the following Node packages to Deno. I know that some of them is
not even have to be ported, but I didn't realised that then.

- [JoshGlazebrook/socks](https://github.com/JoshGlazebrook/socks) —
  [deno_socks](https://github.com/dcdunkan/deno_socks)
- [indutny/node-ip](https://github.com/indutny/node-ip) —
  [deno_ip](https://github.com/dcdunkan/deno_ip)
- [JoshGlazebrook/smart-buffer](https://github.com/JoshGlazebrook/smart-buffer)
  — [deno_smart_buffer](https://github.com/dcdunkan/deno_smart_buffer)
- [spalt08/cryptography](https://github.com/spalt08/cryptography) —
  [deno_cryptography](https://github.com/dcdunkan/deno_cryptography)

## Contributing

Pull requests are welcome. **But**, I only suggest you to open pull requests if
they are related to fixes or improvments with the porting, migrating from Node
packages to Deno's built-in or std stuff, etc. Pull requests related to GramJS
core itself are not very welcomed here, because I was thinking about following
the original GramJS repository and keeping up with their changes.

I am not experienced in most of the core stuff used in GramJS. Most importantly,
websockets. I really want to migrate from using Node modules such as
[socks](https://github.com/JoshGlazebrook/socks) and
[websocket](https://github.com/theturtle32/WebSocket-Node) to using Deno's
built-in websocket stuff, if it is possible (it should be). If you can help
migrating it, that would be great!

## Credits

I only ported the library by changing some imports and porting some dependencies
to Deno, anyone could do it.

All actual credits goes to

- the original
  [authors and contributors](https://github.com/gram-js/gramjs/graphs/contributors)
  of GramJS,
- authors of the dependencies,
- authors of already ported dependencies,
- and everyone else who was a part of this.
