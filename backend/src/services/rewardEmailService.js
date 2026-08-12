// =====================================================
// KUDOS EMAIL SERVICE
// =====================================================
//
// Uses Brevo HTTPS API.
// No SMTP / Nodemailer required.
//
// Works with Render Free because the email request
// goes over HTTPS.
//
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
// BREVO API
// =====================================================

const BREVO_URL =
  "https://api.brevo.com/v3/smtp/email";


// =====================================================
// SEND THROUGH BREVO
// =====================================================

async function sendBrevoEmail({

  recipientEmail,

  recipientName,

  subject,

  text,

  html,

  cc = true,

}) {

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

  if (!recipientEmail) {

    throw new Error(
      "Recipient email is required."
    );

  }


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
  // CC TEST ACCOUNT
  // ===================================================

  if (

    cc &&

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
  // SEND
  // ===================================================

  const response =
    await fetch(
      BREVO_URL,
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


  // ===================================================
  // BREVO ERROR
  // ===================================================

  if (!response.ok) {

    console.error(
      "Brevo email API error:",
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

      `Brevo email API failed with status ${response.status}`

    );

  }


  console.log(
    "Brevo email sent:",
    {

      recipientEmail,

      cc:
        cc
          ? STATUS_CC_EMAIL
          : undefined,

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
// VERIFY EMAIL CONNECTION
// =====================================================
//
// Unlike SMTP, there is no persistent connection.
// We simply verify that the API key exists.
//
// =====================================================

async function verifyEmailConnection() {

  if (!BREVO_API_KEY) {

    console.error(
      "Brevo email service is not configured."
    );

    return false;

  }


  if (!EMAIL_FROM) {

    console.error(
      "Brevo EMAIL_FROM is not configured."
    );

    return false;

  }


  console.log(
    "Brevo email service configured successfully."
  );


  return true;

}


// =====================================================
// MASK UPI
// =====================================================

function maskUpi(
  upiId
) {

  if (!upiId) {

    return "Not provided";

  }


  const value =
    String(
      upiId
    );


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

  switch (
    String(
      status || ""
    ).toLowerCase()
  ) {


    // =================================================
    // PROCESSING
    // =================================================

    case "processing":

      return {

        label:
          "Processing",

        title:
          "Your Kudos reward is being processed",

        message:
          "Your Kudos reward payout has been initiated and is currently being processed by the payment provider.",

      };


    // =================================================
    // SUCCESS
    // =================================================

    case "claimed":

    case "processed":

    case "success":

    case "successful":

    case "completed":

      return {

        label:
          "Successful",

        title:
          "Your Kudos reward was successfully paid",

        message:
          "Your Kudos reward has been successfully processed. The payout has been completed.",

      };


    // =================================================
    // FAILED
    // =================================================

    case "failed":

    case "failure":

      return {

        label:
          "Failed",

        title:
          "Your Kudos reward payment failed",

        message:
          "We were unable to complete your Kudos reward payout. Please contact your organization administrator if you need assistance.",

      };


    // =================================================
    // REVERSED
    // =================================================

    case "reversed":

      return {

        label:
          "Reversed",

        title:
          "Your Kudos reward payment was reversed",

        message:
          "The payment provider reversed your Kudos reward payout. Please contact your organization administrator for assistance.",

      };


    // =================================================
    // PENDING
    // =================================================

    case "pending":

      return {

        label:
          "Pending",

        title:
          "Your Kudos reward is pending",

        message:
          "Your Kudos reward has been created and is waiting to be processed.",

      };


    // =================================================
    // EXPIRED
    // =================================================

    case "expired":

      return {

        label:
          "Expired",

        title:
          "Your Kudos reward has expired",

        message:
          "Your Kudos reward claim or payout has expired and could not be completed.",

      };


    // =================================================
    // DEFAULT
    // =================================================

    default:

      return {

        label:
          status ||
          "Updated",

        title:
          "Your Kudos reward status was updated",

        message:
          `Your Kudos reward status has been updated to ${
            status ||
            "updated"
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
  // FAILURE SECTION
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

          ${escapeHtml(
            failureReason
          )}

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

  <meta
    name="viewport"
    content="width=device-width,initial-scale=1"
  />

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
          escapeHtml(
            recipientName ||
            "there"
          )
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
            ${escapeHtml(
              payoutId ||
              "N/A"
            )}
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
            ${escapeHtml(
              referenceId ||
              "N/A"
            )}
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


      <!-- FAILED -->

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


      <!-- REVERSED -->

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


      <!-- EXPIRED -->

      ${
        status === "expired"

          ? `

            <div
              style="
                margin-top:24px;
                padding:16px;
                background:#f3f4f6;
                border-radius:8px;
                color:#374151;
                line-height:1.5;
              "
            >

              This reward has expired and
              cannot be processed.

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

      This is an automated transaction
      notification from Kudos.

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

Payout ID:
${payoutId || "N/A"}

Transaction Reference:
${referenceId || "N/A"}

Date:
${formattedDate}

${
  failureReason
    ? `Reason: ${failureReason}`
    : ""
}

This is an automated email from Kudos.

Please do not reply to this email.

`;


  // ===================================================
  // SEND
  // ===================================================

  const result =
    await sendBrevoEmail({

      recipientEmail,

      recipientName,

      subject,

      text,

      html,

      cc:
        true,

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
        result.messageId,

    }
  );


  // ===================================================
  // RETURN
  // ===================================================

  return {

    success:
      true,

    messageId:
      result.messageId,

    recipientEmail,

    cc:
      STATUS_CC_EMAIL,

    status,

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


// =====================================================
// EXPORT
// =====================================================

module.exports = {

  sendPayoutStatusEmail,

  verifyEmailConnection,

};
