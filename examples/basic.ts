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
await client.sendMessage("me", { message: "Hello!" });
