const nodemailer = require("nodemailer");

// =====================================================
// TEST EMAIL CONFIGURATION
// =====================================================

const EMAIL_USER =
  process.env.EMAIL_USER;

const EMAIL_PASSWORD =
  process.env.EMAIL_PASSWORD;

const STATUS_CC_EMAIL =
  process.env.REWARD_STATUS_CC_EMAIL ||
  "testdishank@gmail.com";


// =====================================================
// VALIDATE CONFIG
// =====================================================

if (!EMAIL_USER) {
  console.warn(
    "WARNING: EMAIL_USER is missing."
  );
}

if (!EMAIL_PASSWORD) {
  console.warn(
    "WARNING: EMAIL_PASSWORD is missing."
  );
}


// =====================================================
// GMAIL SMTP TRANSPORT
// =====================================================

const transporter =
  nodemailer.createTransport({

    service: "gmail",

    auth: {
      user:
        EMAIL_USER,

      pass:
        EMAIL_PASSWORD,
    },

  });


// =====================================================
// VERIFY EMAIL CONNECTION
// =====================================================

async function verifyEmailConnection() {

  try {

    await transporter.verify();

    console.log(
      "Email service connected successfully."
    );

    return true;

  } catch (error) {

    console.error(
      "Email service connection failed:",
      error.message
    );

    return false;

  }

}


// =====================================================
// MASK UPI
// =====================================================
//
// We do not store the user's UPI ID.
// If a masked value is temporarily available,
// this function can safely display it.
//
// Examples:
//
// abc123@upi → ab***@upi
// test@upi   → te***@upi
// =====================================================

function maskUpi(
  upiId
) {

  if (!upiId) {

    return "Not provided";

  }


  const value =
    String(upiId);


  const atIndex =
    value.indexOf("@");


  if (
    atIndex <= 0
  ) {

    return "***";

  }


  const username =
    value.substring(
      0,
      atIndex
    );


  const domain =
    value.substring(
      atIndex
    );


  if (
    username.length <= 2
  ) {

    return (
      "**" +
      domain
    );

  }


  return (
    username.substring(
      0,
      2
    ) +
    "***" +
    domain
  );

}


// =====================================================
// FORMAT DATE
// =====================================================

function formatDate(
  date
) {

  const value =
    date
      ? new Date(date)
      : new Date();


  return value.toLocaleString(
    "en-IN",
    {
      timeZone:
        "Asia/Kolkata",

      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric",

      hour:
        "2-digit",

      minute:
        "2-digit",

    }
  );

}


// =====================================================
// STATUS CONTENT
// =====================================================

function getStatusContent(
  status
) {

  switch (status) {

    // -----------------------------------------------
    // PROCESSING
    // -----------------------------------------------

    case "processing":

      return {

        label:
          "Processing",

        title:
          "Your Kudos reward is being processed",

        message:
          "Your Kudos reward payout has been initiated and is currently being processed by the payment provider.",

      };


    // -----------------------------------------------
    // SUCCESS
    // -----------------------------------------------

    case "claimed":

    case "processed":

      return {

        label:
          "Successful",

        title:
          "Your Kudos reward was successfully paid",

        message:
          "Your Kudos reward has been successfully processed. The payout has been completed.",

      };


    // -----------------------------------------------
    // FAILED
    // -----------------------------------------------

    case "failed":

      return {

        label:
          "Failed",

        title:
          "Your Kudos reward payment failed",

        message:
          "We were unable to complete your Kudos reward payout. Please contact your organization administrator if you need assistance.",

      };


    // -----------------------------------------------
    // REVERSED
    // -----------------------------------------------

    case "reversed":

      return {

        label:
          "Reversed",

        title:
          "Your Kudos reward payment was reversed",

        message:
          "The payment provider reversed your Kudos reward payout. Please contact your organization administrator for assistance.",

      };


    // -----------------------------------------------
    // DEFAULT
    // -----------------------------------------------

    default:

      return {

        label:
          status ||
          "Updated",

        title:
          "Your Kudos reward status was updated",

        message:
          `Your Kudos reward status has been updated to ${
            status || "updated"
          }.`,
      };

  }

}


// =====================================================
// SEND PAYOUT STATUS EMAIL
// =====================================================

async function sendPayoutStatusEmail({

  recipientEmail,

  recipientName,

  amountInr,

  points,

  upiId,

  status,

  payoutId,

  referenceId,

  transactionDate,

  failureReason,

}) {

  // ===================================================
  // VALIDATION
  // ===================================================

  if (!recipientEmail) {

    throw new Error(
      "Recipient email is required."
    );

  }


  if (!EMAIL_USER) {

    throw new Error(
      "EMAIL_USER is missing."
    );

  }


  if (!EMAIL_PASSWORD) {

    throw new Error(
      "EMAIL_PASSWORD is missing."
    );

  }


  // ===================================================
  // STATUS
  // ===================================================

  const statusContent =
    getStatusContent(
      status
    );


  // ===================================================
  // AMOUNT
  // ===================================================

  const numericAmount =
    Number(
      amountInr || 0
    );


  const formattedAmount =
    numericAmount.toLocaleString(
      "en-IN",
      {
        minimumFractionDigits:
          2,

        maximumFractionDigits:
          2,
      }
    );


  // ===================================================
  // DATE
  // ===================================================

  const formattedDate =
    formatDate(
      transactionDate
    );


  // ===================================================
  // UPI
  // ===================================================

  const displayedUpi =
    maskUpi(
      upiId
    );


  // ===================================================
  // SUBJECT
  // ===================================================

  const subject =
    `Kudos Reward ₹${formattedAmount} — ${statusContent.label}`;


  // ===================================================
  // OPTIONAL FAILURE REASON
  // ===================================================

  const failureSection =
    (
      status === "failed" ||
      status === "reversed"
    ) && failureReason

      ? `

        <div
          style="
            margin-top:20px;
            padding:14px 16px;
            background:#fef2f2;
            border-radius:8px;
            color:#991b1b;
          "
        >

          <strong>
            Reason:
          </strong>

          ${failureReason}

        </div>

      `

      : "";


  // ===================================================
  // HTML EMAIL
  // ===================================================

  const html = `

<!DOCTYPE html>

<html>

<head>

  <meta charset="UTF-8" />

  <title>
    Kudos Reward
  </title>

</head>


<body
  style="
    margin:0;
    padding:0;
    background:#f5f7f6;
    font-family:Arial,Helvetica,sans-serif;
  "
>

  <div
    style="
      max-width:600px;
      margin:40px auto;
      background:#ffffff;
      border-radius:12px;
      overflow:hidden;
      border:1px solid #e5e7eb;
    "
  >

    <!-- HEADER -->

    <div
      style="
        padding:24px 28px;
        background:#111827;
        color:#ffffff;
      "
    >

      <h1
        style="
          margin:0;
          font-size:24px;
        "
      >
        Kudos
      </h1>

      <p
        style="
          margin:6px 0 0;
          color:#d1d5db;
        "
      >
        Reward Transaction Update
      </p>

    </div>


    <!-- CONTENT -->

    <div
      style="
        padding:28px;
      "
    >

      <h2
        style="
          margin:0 0 14px;
          color:#111827;
        "
      >
        ${statusContent.title}
      </h2>


      <p
        style="
          color:#4b5563;
          line-height:1.6;
        "
      >

        Hi ${
          recipientName ||
          "there"
        },

      </p>


      <p
        style="
          color:#4b5563;
          line-height:1.6;
        "
      >

        ${statusContent.message}

      </p>


      <!-- STATUS -->

      <div
        style="
          margin:24px 0;
          padding:16px;
          background:#f3f4f6;
          border-radius:8px;
        "
      >

        <div
          style="
            font-size:13px;
            color:#6b7280;
            margin-bottom:6px;
          "
        >
          Transaction Status
        </div>


        <strong
          style="
            font-size:20px;
            color:#111827;
          "
        >
          ${statusContent.label}
        </strong>

      </div>


      <!-- TRANSACTION DETAILS -->

      <table
        style="
          width:100%;
          border-collapse:collapse;
          margin-top:20px;
        "
      >

        <tr>

          <td
            style="
              padding:10px 0;
              color:#6b7280;
            "
          >
            Reward Amount
          </td>

          <td
            style="
              padding:10px 0;
              text-align:right;
              font-weight:bold;
              color:#111827;
            "
          >
            ₹${formattedAmount}
          </td>

        </tr>


        <tr>

          <td
            style="
              padding:10px 0;
              color:#6b7280;
            "
          >
            Points
          </td>

          <td
            style="
              padding:10px 0;
              text-align:right;
              color:#111827;
            "
          >
            ${points || 0}
          </td>

        </tr>


        <tr>

          <td
            style="
              padding:10px 0;
              color:#6b7280;
            "
          >
            UPI
          </td>

          <td
            style="
              padding:10px 0;
              text-align:right;
              color:#111827;
            "
          >
            ${displayedUpi}
          </td>

        </tr>


        <tr>

          <td
            style="
              padding:10px 0;
              color:#6b7280;
            "
          >
            Payout ID
          </td>

          <td
            style="
              padding:10px 0;
              text-align:right;
              color:#111827;
              word-break:break-all;
            "
          >
            ${payoutId || "N/A"}
          </td>

        </tr>


        <tr>

          <td
            style="
              padding:10px 0;
              color:#6b7280;
            "
          >
            Transaction Reference
          </td>

          <td
            style="
              padding:10px 0;
              text-align:right;
              color:#111827;
              word-break:break-all;
            "
          >
            ${referenceId || "N/A"}
          </td>

        </tr>


        <tr>

          <td
            style="
              padding:10px 0;
              color:#6b7280;
            "
          >
            Date
          </td>

          <td
            style="
              padding:10px 0;
              text-align:right;
              color:#111827;
            "
          >
            ${formattedDate}
          </td>

        </tr>

      </table>


      ${failureSection}


      <!-- FAILURE HELP -->

      ${
        status === "failed"
          ? `

            <div
              style="
                margin-top:24px;
                padding:16px;
                background:#fef2f2;
                border-radius:8px;
                color:#991b1b;
                line-height:1.5;
              "
            >

              Please contact your organization
              administrator if you need assistance
              with this transaction.

            </div>

          `
          : ""
      }


      ${
        status === "reversed"
          ? `

            <div
              style="
                margin-top:24px;
                padding:16px;
                background:#fff7ed;
                border-radius:8px;
                color:#9a3412;
                line-height:1.5;
              "
            >

              Please contact your organization
              administrator regarding this
              reversed transaction.

            </div>

          `
          : ""
      }

    </div>


    <!-- FOOTER -->

    <div
      style="
        padding:20px 28px;
        background:#f9fafb;
        color:#6b7280;
        font-size:12px;
        line-height:1.5;
      "
    >

      This is an automated transaction notification
      from Kudos.

      <br />

      Please do not reply to this email.

    </div>

  </div>

</body>

</html>

`;


  // ===================================================
  // PLAIN TEXT EMAIL
  // ===================================================

  const text = `

Kudos Reward Transaction Update

Hi ${
  recipientName ||
  "there"
},

${statusContent.message}

TRANSACTION DETAILS

Reward Amount: ₹${formattedAmount}
Points: ${points || 0}
UPI: ${displayedUpi}
Status: ${statusContent.label}
Payout ID: ${payoutId || "N/A"}
Transaction Reference: ${
  referenceId || "N/A"
}
Date: ${formattedDate}

${
  failureReason
    ? `Reason: ${failureReason}`
    : ""
}

This is an automated email from Kudos.

Please do not reply to this email.

`;


  // ===================================================
  // SEND EMAIL
  // ===================================================

  const info =
    await transporter.sendMail({

      from:
        `"Kudos" <${EMAIL_USER}>`,

      to:
        recipientEmail,

      cc:
        STATUS_CC_EMAIL,

      subject,

      text,

      html,

    });


  // ===================================================
  // LOG
  // ===================================================

  console.log(
    "Reward transaction email sent:",
    {

      recipientEmail,

      cc:
        STATUS_CC_EMAIL,

      status,

      amountInr:
        numericAmount,

      points,

      payoutId,

      referenceId,

      messageId:
        info.messageId,

    }
  );


  // ===================================================
  // RETURN
  // ===================================================

  return {

    success:
      true,

    messageId:
      info.messageId,

    recipientEmail,

    cc:
      STATUS_CC_EMAIL,

    status,

  };

}


// =====================================================
// EXPORT
// =====================================================

module.exports = {

  sendPayoutStatusEmail,

  verifyEmailConnection,

};