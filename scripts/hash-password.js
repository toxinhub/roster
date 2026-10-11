const crypto = require("node:crypto");
const readline = require("node:readline");

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error("Run this script in an interactive terminal so the password is not echoed.");
  process.exit(1);
}
const input = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
process.stdout.write("Enter password (input hidden): ");
let password = "";
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on("data", chunk => {
  for (const byte of chunk) {
    if (byte === 3) process.exit(130);
    if (byte === 13 || byte === 10) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      input.close();
      if (password.length < 12) {
        console.error("Use a password of at least 12 characters.");
        process.exit(1);
      }
      const salt = crypto.randomBytes(16);
      crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (err, key) => {
        password = "";
        if (err) {
          console.error("Hash generation failed.");
          process.exit(1);
        }
        process.stdout.write("Copy this hash into the matching Vercel environment variable; do not share the password itself:\n");
        process.stdout.write("scrypt$" + salt.toString("base64url") + "$" + key.toString("base64url") + "\n");
        process.exit(0);
      });
      return;
    }
    if (byte === 127 || byte === 8) password = password.slice(0, -1);
    else if (byte >= 32 && byte <= 126 && password.length < 256) password += String.fromCharCode(byte);
  }
});
