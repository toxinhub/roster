const crypto = require("node:crypto");

if (!process.stdin.isTTY || !process.stdout.isTTY || typeof process.stdin.setRawMode !== "function") {
  console.error("Run this script in an interactive terminal so the password is not echoed.");
  process.exit(1);
}

process.stdout.write("Enter password (hidden; minimum 12 characters): ");
let password = "";
let finished = false;
process.stdin.setRawMode(true);
process.stdin.resume();

function finish(exitCode) {
  if (finished) return;
  finished = true;
  process.stdin.setRawMode(false);
  process.stdin.pause();
  process.stdin.removeListener("data", onData);
  process.stdout.write("\\n");
  if (exitCode !== 0) process.exit(exitCode);
}

function onData(chunk) {
  for (const byte of chunk) {
    if (byte === 3) {
      password = "";
      finish(130);
      return;
    }
    if (byte === 13 || byte === 10) {
      finish(0);
      if (password.length < 12) {
        password = "";
        console.error("Use a password of at least 12 characters.");
        process.exitCode = 1;
        return;
      }
      const secret = password;
      password = "";
      const salt = crypto.randomBytes(16);
      crypto.scrypt(secret, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (err, key) => {
        if (err) {
          console.error("Hash generation failed.");
          process.exitCode = 1;
          return;
        }
        process.stdout.write("Copy this hash into the matching Vercel environment variable; never share the password itself:\\n");
        process.stdout.write("scrypt$" + salt.toString("base64url") + "$" + key.toString("base64url") + "\\n");
      });
      return;
    }
    if (byte === 127 || byte === 8) {
      password = password.slice(0, -1);
    } else if (byte >= 32 && byte <= 126 && password.length < 256) {
      password += String.fromCharCode(byte);
    }
  }
}

process.stdin.on("data", onData);
