const crypto = require("crypto");

function verifySlackRequest(req) {
  const signingSecret =
    process.env.SLACK_SIGNING_SECRET;

  const timestamp =
    req.headers["x-slack-request-timestamp"];

  const slackSignature =
    req.headers["x-slack-signature"];

  if (!timestamp || !slackSignature) {
    return false;
  }

  // Prevent replay attacks
  const currentTime =
    Math.floor(Date.now() / 1000);

  if (
    Math.abs(currentTime - Number(timestamp)) >
    60 * 5
  ) {
    return false;
  }

  const rawBody =
    req.rawBody || "";

  const sigBaseString =
    `v0:${timestamp}:${rawBody}`;

  const mySignature =
    "v0=" +
    crypto
      .createHmac(
        "sha256",
        signingSecret
      )
      .update(sigBaseString)
      .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(mySignature),
    Buffer.from(slackSignature)
  );
}

module.exports =
  verifySlackRequest;