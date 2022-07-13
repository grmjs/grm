import { StringSession, TelegramClient } from "../mod.ts";

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
