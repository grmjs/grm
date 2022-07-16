import { DatabaseSession, DatabaseType, TelegramClient } from "https://deno.land/x/grm/mod.ts";

// Login and create an application on https://my.telegram.org
// to get values for API ID and API Hash.
const apiId = 123456;
const apiHash = "abcd1234";

// Fill in this later with the value from client.session.save(),
// so you don't have to login each time you run the file.
const dbSession = new DatabaseSession("sessionName", {
  type: DatabaseType.SQLite,
  adapterOptions: {
    file: "examples/session.db",
  },
});

console.log("Loading interactive example...");
const client = new TelegramClient(dbSession, apiId, apiHash, {
  connectionRetries: 5,
});

await client.start({
  phoneNumber: () => prompt("Enter your phone number:")!,
  password: async () => await prompt("Enter your password:")!,
  phoneCode: async () => await prompt("Enter the code you received:")!,
  onError: (err: Error) => console.log(err),
});

console.log("You should now be connected.");
// Save the output of the following and use it in `new SessionString("")`
// to avoid logging in again next time.
console.log(client.session.save());

// Send a message to yourself
await client.sendMessage("me", { message: "Hello!" });
