const nodemailer = require("nodemailer");

// =====================================================
// SMTP CONFIGURATION
// =====================================================

const SMTP_HOST =
  process.env.SMTP_HOST || "smtp.gmail.com";

const SMTP_PORT =
  Number(process.env.SMTP_PORT || 587);

const SMTP_SECURE =
  process.env.SMTP_SECURE === "true";

const SMTP_USER =
  process.env.SMTP_USER ||
  process.env.EMAIL_USER;

const SMTP_PASSWORD =
  process.env.SMTP_PASSWORD ||
  process.env.EMAIL_PASSWORD;

const EMAIL_FROM =
  process.env.EMAIL_FROM ||
  SMTP_USER;

// =====================================================
// VALIDATE CONFIG
// =====================================================

if (!SMTP_USER) {
  console.warn(
    "WARNING: SMTP_USER / EMAIL_USER is missing."
  );
}

if (!SMTP_PASSWORD) {
  console.warn(
    "WARNING: SMTP_PASSWORD / EMAIL_PASSWORD is missing."
  );
}

// =====================================================
// SMTP TRANSPORTER
// =====================================================

const transporter =
  nodemailer.createTransport({

    host:
      SMTP_HOST,

    port:
      SMTP_PORT,

    secure:
      SMTP_SECURE,

    // Required for Gmail SMTP on port 587.
    // Ignored when using secure=true / port 465.
    requireTLS:
      SMTP_PORT === 587,

    auth: {

      user:
        SMTP_USER,

      pass:
        SMTP_PASSWORD,

    },

    // Render/cloud environments can occasionally
    // take longer to establish an SMTP connection.
    connectionTimeout:
      30000,

    greetingTimeout:
      30000,

    socketTimeout:
      30000,

  });

// =====================================================
// VERIFY SMTP CONNECTION
// =====================================================

async function verifyEmailConnection() {

  try {

    await transporter.verify();

    console.log(
      "Claim email SMTP connection successful."
    );

    return true;

  } catch (error) {

    console.error(
      "Claim email SMTP connection failed:",
      {
        code:
          error.code,

        command:
          error.command,

        message:
          error.message,
      }
    );

    return false;

  }

}

// =====================================================
// SEND CLAIM EMAIL
// =====================================================

async function sendRewardClaimEmail({

  recipientEmail,

  recipientName,

  amountInr,

  points,

  claimUrl,

  expiresAt,

}) {

  // ===================================================
  // VALIDATION
  // ===================================================

  if (!recipientEmail) {

    throw new Error(
      "Recipient email is required."
    );

  }

  if (!SMTP_USER) {

    throw new Error(
      "SMTP_USER / EMAIL_USER is missing."
    );

  }

  if (!SMTP_PASSWORD) {

    throw new Error(
      "SMTP_PASSWORD / EMAIL_PASSWORD is missing."
    );

  }

  if (!claimUrl) {

    throw new Error(
      "Claim URL is required."
    );

  }

  // ===================================================
  // AMOUNT
  // ===================================================

  const numericAmount =
    Number(amountInr || 0);

  const formattedAmount =
    numericAmount.toLocaleString(
      "en-IN"
    );

  // ===================================================
  // EXPIRY
  // ===================================================

  const expiryText =
    expiresAt

      ? new Date(
          expiresAt
        ).toLocaleString(
          "en-IN",
          {
            timeZone:
              "Asia/Kolkata",

            dateStyle:
              "medium",

            timeStyle:
              "short",
          }
        )

      : "the expiry date";

  // ===================================================
  // SAFE HTML VALUES
  // ===================================================

  const safeRecipientName =
    escapeHtml(
      recipientName ||
      "there"
    );

  const safeClaimUrl =
    escapeHtml(
      claimUrl
    );

  // ===================================================
  // SUBJECT
  // ===================================================

  const subject =
    "Your Kudos reward is ready 🎁";

  // ===================================================
  // PLAIN TEXT
  // ===================================================

  const text = `

Hi ${recipientName || "there"},

You have received a Kudos reward.

Points: ${points || 0}
Reward value: ₹${formattedAmount}

Claim your reward here:

${claimUrl}

Claim before:
${expiryText}

When you claim the reward, you will be asked for your UPI ID.

This is a Razorpay Test Mode transaction.
No real money will be transferred.

Thanks,
Kudos

`;

  // ===================================================
  // HTML
  // ===================================================

  const html = `

<!DOCTYPE html>

<html>

<head>

  <meta charset="UTF-8" />

  <meta
    name="viewport"
    content="width=device-width,initial-scale=1"
  />

  <title>
    Your Kudos reward is ready
  </title>

</head>

<body
  style="
    margin:0;
    padding:0;
    background:#f5f7f9;
    font-family:Arial,Helvetica,sans-serif;
  "
>

  <div
    style="
      max-width:600px;
      margin:40px auto;
      background:#ffffff;
      border-radius:12px;
      padding:40px;
      box-sizing:border-box;
    "
  >

    <h1
      style="
        margin:0 0 8px;
        color:#111827;
      "
    >
      Kudos 🎁
    </h1>

    <h2
      style="
        margin:0 0 20px;
        color:#111827;
      "
    >
      Your reward is ready
    </h2>

    <p>
      Hi ${safeRecipientName},
    </p>

    <p>
      You have received a Kudos reward.
    </p>

    <!-- REWARD -->

    <div
      style="
        background:#f5f5f5;
        padding:24px;
        border-radius:10px;
        text-align:center;
        margin:25px 0;
      "
    >

      <div
        style="
          font-size:14px;
          color:#666;
        "
      >
        Reward value
      </div>

      <div
        style="
          font-size:32px;
          font-weight:bold;
          margin-top:8px;
          color:#111827;
        "
      >
        ₹${formattedAmount}
      </div>

      <div
        style="
          color:#666;
          margin-top:8px;
        "
      >
        ${points || 0} Kudos points
      </div>

    </div>

    <p>
      Click below to claim your reward.
    </p>

    <!-- CLAIM BUTTON -->

    <div
      style="
        text-align:center;
        margin:30px 0;
      "
    >

      <a
        href="${safeClaimUrl}"
        style="
          display:inline-block;
          background:#111827;
          color:#ffffff;
          padding:14px 28px;
          border-radius:8px;
          text-decoration:none;
          font-weight:bold;
        "
      >
        Claim ₹${formattedAmount}
      </a>

    </div>

    <p
      style="
        color:#666;
        font-size:14px;
      "
    >
      Claim before ${expiryText}.
    </p>

    <!-- TEST MODE -->

    <div
      style="
        background:#fff7ed;
        color:#9a3412;
        padding:15px;
        border-radius:8px;
        font-size:13px;
        margin-top:25px;
        line-height:1.5;
      "
    >

      <strong>
        Test Mode
      </strong>

      <br />

      This is a Razorpay Test Mode
      transaction. No real money will
      be transferred.

    </div>

    <p
      style="
        color:#999;
        font-size:12px;
        margin-top:35px;
      "
    >
      This email was sent by Kudos.
    </p>

  </div>

</body>

</html>

`;

  // ===================================================
  // SEND
  // ===================================================

  try {

    const result =
      await transporter.sendMail({

        from:
          `"Kudos" <${EMAIL_FROM}>`,

        to:
          recipientEmail,

        subject,

        text,

        html,

      });

    // =================================================
    // LOG
    // =================================================

    console.log(
      "Reward claim email sent:",
      {

        recipientEmail,

        messageId:
          result.messageId,

      }
    );

    // =================================================
    // RETURN
    // =================================================

    return {

      success:
        true,

      messageId:
        result.messageId,

      recipientEmail,

    };

  } catch (error) {

    console.error(
      "Reward claim email failed:",
      {

        recipientEmail,

        code:
          error.code,

        command:
          error.command,

        message:
          error.message,

      }
    );

    throw error;

  }

}

// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHtml(
  value
) {

  return String(
    value || ""
  )

    .replace(
      /&/g,
      "&amp;"
    )

    .replace(
      /</g,
      "&lt;"
    )

    .replace(
      />/g,
      "&gt;"
    )

    .replace(
      /"/g,
      "&quot;"
    )

    .replace(
      /'/g,
      "&#039;"
    );

}

// =====================================================
// EXPORT
// =====================================================

module.exports = {

  sendRewardClaimEmail,

  verifyEmailConnection,

};
