> **Warning**: Could be unstable, I don't know.

# GramJS for Deno

[GramJS](https://github.com/gram-js/gramjs) is a popular Telegram client written
in JavaScript for Node.js and browsers, with its core being based on
[Telethon](https://github.com/LonamiWebs/Telethon).

And this, hehe. This is a port of **GramJS for Deno**. It is written in
TypeScript.

What is Deno? https://deno.land

## Documentation

Consider following the original GramJS documentation. However, you can follow
the [Getting Started](#getting-started) example for a start.

## Getting started

> **Note**: This was copied from
> [GramJS README](https://github.com/gram-js/gramjs/#how-to-get-started), then
> modified.

Here you'll learn how to obtain necessary information to create telegram
application, authorize into your account and send yourself a message.

First, you'll need to obtain an API ID and hash:

1. Login into your [Telegram account](https://my.telegram.org)
2. Then click "API development tools" and fill your application details (only
   app title and short name required)
3. Finally, click "Create application"

> **Warning**
>
> **Never** share any API/authorization details, that will compromise your
> application and account.

When you've successfully created the application set the API ID and hash you
just got from Telegram in the following code.

```ts
import { StringSession, TelegramClient } from "https://deno.land/x/gram/mod.ts";

const apiId = 123456;
const apiHash = "abcd1234";
// fill this later with the value from session.save()
const stringSession = new StringSession("");

(async function () {
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
  // Save this string to avoid logging in again
  console.log(client.session.save());

  // Send a message to yourself
  await client.sendMessage("me", { message: "Hello!" });
})();
```

Lets run it:

```bash
deno run -A example-file.ts
```

You'll be prompted to enter your phone number, and code you received. Then you
should have a "Hello" message in your Saved Messages.

## Notes

This is a direct port of GramJS for Deno. And this is just an attempt, which
turns out to be an successful attempt. At least, the startup and the getting
started example works. I'm glad about it. And I don't know this works for you,
but it works for me :)

It took me like 4 days. Total of 20h6m for this repository alone. And including
ported dependencies and figuring out the original code, its a total of almost
34.8h. I didn't just copy and paste stuff — I did, but I manually wrote lot of
the files.

I haven't added any JSDocs yet. I'll add them later. I didn't add any for ease
of porting. Its a mess if there are a lot of comments while porting (We can just
collapse them, I know. But my machine can't take too much load).

I had to port the following Node packages to Deno. I know that some of them is
not even has to be ported, but I didn't realised that then.

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
they are related to fixes or improvments with the porting, migrating from node
packages to Deno's built-in or std stuff, etc. Pull requests related to GramJS
core itself are not very welcome here, because I was thinking to keep up with
the original repository.

I am not very experienced in most of the core stuff used in GramJS. Most
importantly, websockets. I really want to migrate from using node packages
[socks](https://github.com/JoshGlazebrook/socks) and
[websocket](https://github.com/theturtle32/WebSocket-Node) to Deno's built-in
websocket stuff, if it is possible (And it should be possible). If you can help
migrating it, it would be great!
