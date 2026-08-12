const nodemailer =
  require("nodemailer");


const transporter =
  nodemailer.createTransport({

    host:
      process.env.SMTP_HOST,

    port:
      Number(
        process.env.SMTP_PORT || 587
      ),

    secure:
      process.env.SMTP_SECURE === "true",

    family: 4,

    auth: {

      user:
        process.env.SMTP_USER,

      pass:
        process.env.SMTP_PASSWORD,

    },

    connectionTimeout: 200000,
    greetingTimeout: 200000,
    socketTimeout: 200000,

  });


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

  if (!recipientEmail) {

    throw new Error(
      "Recipient email is required."
    );

  }


  const expiryText =
    expiresAt
      ? new Date(
          expiresAt
        ).toLocaleString(
          "en-IN",
          {
            dateStyle:
              "medium",
            timeStyle:
              "short",
          }
        )
      : "the expiry date";


  const subject =
    "Your Kudos reward is ready 🎁";


  const text = `

Hi ${recipientName || "there"},

You have received a Kudos reward.

Points: ${points}
Reward value: ₹${Number(
    amountInr
  ).toLocaleString("en-IN")}

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


  const html = `

<!DOCTYPE html>

<html>

<body
  style="
    margin:0;
    padding:0;
    background:#f5f7f9;
    font-family:Arial,sans-serif;
  "
>

  <div
    style="
      max-width:600px;
      margin:40px auto;
      background:#ffffff;
      border-radius:12px;
      padding:40px;
    "
  >

    <h1>
      Kudos 🎁
    </h1>


    <h2>
      Your reward is ready
    </h2>


    <p>
      Hi ${escapeHtml(
        recipientName ||
        "there"
      )},
    </p>


    <p>
      You have received a Kudos reward.
    </p>


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
        "
      >
        ₹${Number(
          amountInr
        ).toLocaleString(
          "en-IN"
        )}
      </div>


      <div
        style="
          color:#666;
          margin-top:8px;
        "
      >
        ${points} Kudos points
      </div>

    </div>


    <p>
      Click below to claim your reward.
    </p>


    <div
      style="
        text-align:center;
        margin:30px 0;
      "
    >

      <a
        href="${claimUrl}"
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
        Claim ₹${Number(
          amountInr
        ).toLocaleString(
          "en-IN"
        )}
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


    <div
      style="
        background:#fff7ed;
        color:#9a3412;
        padding:15px;
        border-radius:8px;
        font-size:13px;
        margin-top:25px;
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


  const result =
    await transporter.sendMail({

      from:
        process.env.EMAIL_FROM,

      to:
        recipientEmail,

      subject,

      text,

      html,

    });


  console.log(
    "Reward claim email sent:",
    {

      recipientEmail,

      messageId:
        result.messageId,

    }
  );


  return {

    success:
      true,

    messageId:
      result.messageId,

  };

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


module.exports = {

  sendRewardClaimEmail,

};
