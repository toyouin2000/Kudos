// =====================================================
// BREVO EMAIL SERVICE
// =====================================================
//
// Uses Brevo's HTTPS API directly.
// No SMTP is required.
//
// Node.js 18+ has built-in fetch.
// Node.js 24 supports it.
// =====================================================

// =====================================================
// CONFIGURATION
// =====================================================

const BREVO_API_KEY =
  process.env.BREVO_API_KEY;

const EMAIL_FROM =
  process.env.EMAIL_FROM;

const EMAIL_FROM_NAME =
  process.env.EMAIL_FROM_NAME ||
  "Kudos";

const STATUS_CC_EMAIL =
  process.env.REWARD_STATUS_CC_EMAIL ||
  "testdishank@gmail.com";

// =====================================================
// VALIDATE CONFIG
// =====================================================

if (!BREVO_API_KEY) {

  console.warn(
    "WARNING: BREVO_API_KEY is missing."
  );

}

if (!EMAIL_FROM) {

  console.warn(
    "WARNING: EMAIL_FROM is missing."
  );

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

  if (!BREVO_API_KEY) {

    throw new Error(
      "BREVO_API_KEY is missing."
    );

  }

  if (!EMAIL_FROM) {

    throw new Error(
      "EMAIL_FROM is missing."
    );

  }

  if (!claimUrl) {

    throw new Error(
      "Claim URL is required."
    );

  }

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
  // AMOUNT
  // ===================================================

  const numericAmount =
    Number(amountInr || 0);

  const formattedAmount =
    numericAmount.toLocaleString(
      "en-IN"
    );

  // ===================================================
  // SAFE VALUES
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
  // TEXT EMAIL
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
  // HTML EMAIL
  // ===================================================

  const html = `

<!DOCTYPE html>

<html>

<head>

  <meta charset="UTF-8" />

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
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
  // BREVO REQUEST
  // ===================================================

  const payload = {

    sender: {

      name:
        EMAIL_FROM_NAME,

      email:
        EMAIL_FROM,

    },

    to: [

      {

        email:
          recipientEmail,

        name:
          recipientName ||
          "Kudos User",

      },

    ],

    subject,

    textContent:
      text,

    htmlContent:
      html,

  };

  // ===================================================
  // CC
  // ===================================================

  if (

    STATUS_CC_EMAIL &&

    STATUS_CC_EMAIL.toLowerCase() !==
      recipientEmail.toLowerCase()

  ) {

    payload.cc = [

      {

        email:
          STATUS_CC_EMAIL,

      },

    ];

  }

  // ===================================================
  // SEND THROUGH BREVO HTTPS API
  // ===================================================

  try {

    console.log(
      "Sending reward claim email through Brevo:",
      {

        recipientEmail,

        cc:
          STATUS_CC_EMAIL,

      }
    );

    const response =
      await fetch(
        "https://api.brevo.com/v3/smtp/email",
        {

          method:
            "POST",

          headers: {

            accept:
              "application/json",

            "api-key":
              BREVO_API_KEY,

            "content-type":
              "application/json",

          },

          body:
            JSON.stringify(
              payload
            ),

        }
      );

    // =================================================
    // RESPONSE
    // =================================================

    const responseText =
      await response.text();

    let result;

    try {

      result =
        JSON.parse(
          responseText
        );

    } catch {

      result = {

        raw:
          responseText,

      };

    }

    // =================================================
    // ERROR
    // =================================================

    if (!response.ok) {

      console.error(
        "Brevo API error:",
        {

          status:
            response.status,

          response:
            result,

        }
      );

      throw new Error(

        result.message ||

        result.code ||

        `Brevo API failed with status ${response.status}`

      );

    }

    // =================================================
    // SUCCESS
    // =================================================

    console.log(
      "Reward claim email sent:",
      {

        recipientEmail,

        cc:
          STATUS_CC_EMAIL,

        messageId:
          result.messageId,

      }
    );

    return {

      success:
        true,

      messageId:
        result.messageId,

      recipientEmail,

      cc:
        STATUS_CC_EMAIL,

    };

  } catch (error) {

    console.error(
      "Reward claim email failed:",
      {

        recipientEmail,

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

};
