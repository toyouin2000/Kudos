const axios = require("axios");
const crypto = require("crypto");

// =====================================================
// RAZORPAY TEST MODE
// =====================================================
//
// IMPORTANT:
// These credentials MUST be RazorpayX TEST MODE keys.
//
// No real money is moved in RazorpayX Test Mode.
//
// =====================================================

const KEY_ID =
  process.env.RAZORPAY_KEY_ID;

const KEY_SECRET =
  process.env.RAZORPAY_KEY_SECRET;

const ACCOUNT_NUMBER =
  process.env.RAZORPAY_ACCOUNT_NUMBER;

const RAZORPAY_BASE_URL =
  "https://api.razorpay.com/v1";

// =====================================================
// VALIDATE CONFIG
// =====================================================

if (!KEY_ID) {
  console.warn(
    "WARNING: RAZORPAY_KEY_ID is missing."
  );
}

if (!KEY_SECRET) {
  console.warn(
    "WARNING: RAZORPAY_KEY_SECRET is missing."
  );
}

if (!ACCOUNT_NUMBER) {
  console.warn(
    "WARNING: RAZORPAY_ACCOUNT_NUMBER is missing."
  );
}

// =====================================================
// HTTP CLIENT
// =====================================================

const razorpayHttp =
  axios.create({

    baseURL:
      RAZORPAY_BASE_URL,

    auth: {

      username:
        KEY_ID,

      password:
        KEY_SECRET,

    },

    headers: {

      "Content-Type":
        "application/json",

    },

    timeout:
      30000,

  });

// =====================================================
// NORMALIZE RAZORPAY CONTACT NAME
// =====================================================
//
// Razorpay contact name:
//
// - Minimum 3 characters
// - Maximum 50 characters
// - Allows letters/numbers
// - Allows spaces
// - Allows apostrophe
// - Allows curly apostrophe
// - Allows hyphen
// - Allows underscore
// - Allows slash
// - Allows parentheses
// - Allows period
// - Cannot end with a special character
//   except period
//
// =====================================================

function normalizeRecipientName(
  name
) {

  // Convert safely to string.
  let normalized =
    String(
      name || ""
    )
      .normalize("NFKC")
      .trim();

  // Replace tabs/newlines/multiple
  // spaces with one space.
  normalized =
    normalized.replace(
      /\s+/g,
      " "
    );

  // Remove unsupported characters.
  normalized =
    normalized.replace(
      /[^a-zA-Z0-9 .’'()_\/-]/g,
      ""
    );

  // Remove leading/trailing spaces.
  normalized =
    normalized.trim();

  // ===================================================
  // MINIMUM LENGTH
  // ===================================================

  if (
    normalized.length < 3
  ) {

    normalized =
      "Kudos User";

  }

  // ===================================================
  // MAXIMUM LENGTH
  // ===================================================

  normalized =
    normalized.slice(
      0,
      50
    );

  // ===================================================
  // REMOVE INVALID TRAILING SPECIAL CHARACTERS
  // ===================================================
  //
  // Period is allowed at the end.
  //
  // Remove:
  // '
  // ’
  // -
  // _
  // /
  // (
  // )
  //
  // ===================================================

  normalized =
    normalized
      .replace(
        /[’'()_\/-]+$/g,
        ""
      )
      .trim();

  // ===================================================
  // FINAL LENGTH CHECK
  // ===================================================

  if (
    normalized.length < 3
  ) {

    normalized =
      "Kudos User";

  }

  return normalized;
}

// =====================================================
// CREATE CONTACT
// =====================================================

async function createTestContact({

  recipientName,

  recipientEmail,

  referenceId,

}) {

  // ===================================================
  // NORMALIZE NAME
  // ===================================================

  const contactName =
    normalizeRecipientName(
      recipientName
    );

  // ===================================================
  // VALIDATE EMAIL
  // ===================================================

  if (!recipientEmail) {

    throw new Error(
      "Recipient email is required."
    );

  }

  const email =
    String(
      recipientEmail
    )
      .trim()
      .toLowerCase();

  const emailRegex =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (
    !emailRegex.test(
      email
    )
  ) {

    throw new Error(
      "Invalid recipient email."
    );

  }

  // ===================================================
  // VALIDATE REFERENCE
  // ===================================================

  if (!referenceId) {

    throw new Error(
      "Reference ID is required."
    );

  }

  // ===================================================
  // SAFE REFERENCE
  // ===================================================

  const safeReference =
    String(
      referenceId
    )
      .replace(
        /[^a-zA-Z0-9_-]/g,
        ""
      )
      .slice(
        0,
        40
      );

  if (!safeReference) {

    throw new Error(
      "Invalid Razorpay reference ID."
    );

  }

  // ===================================================
  // PAYLOAD
  // ===================================================

  const payload = {

    name:
      contactName,

    email:
      email,

    type:
      "employee",

    reference_id:
      safeReference,

  };

  // ===================================================
  // DEBUG LOG
  // ===================================================

  console.log(
    "Creating Razorpay TEST contact:",
    {

      originalName:
        recipientName,

      normalizedName:
        contactName,

      nameLength:
        contactName.length,

      nameCharCodes:
        [...contactName].map(
          (character) => ({

            character,

            code:
              character.charCodeAt(0),

          })
        ),

      email:
        email,

      referenceId:
        safeReference,

    }
  );

  // ===================================================
  // CREATE CONTACT
  // ===================================================

  try {

    const response =
      await razorpayHttp.post(
        "/contacts",
        payload
      );

    const contact =
      response.data;

    console.log(
      "Razorpay TEST contact created:",
      {

        id:
          contact.id,

        name:
          contact.name,

      }
    );

    return {

      id:
        contact.id,

      name:
        contact.name,

      email:
        contact.email,

      raw:
        contact,

    };

  } catch (error) {

    logRazorpayError(
      "create contact",
      error
    );

    throw normalizeRazorpayError(
      "Unable to create Razorpay TEST contact.",
      error
    );

  }

}

// =====================================================
// CREATE VPA FUND ACCOUNT
// =====================================================
//
// The employee's UPI ID is sent to Razorpay here.
//
// We do NOT save the UPI ID in Supabase.
//
// =====================================================

async function createTestVpaFundAccount({

  contactId,

  upiId,

}) {

  // ===================================================
  // VALIDATE CONTACT
  // ===================================================

  if (!contactId) {

    throw new Error(
      "Razorpay contact ID is required."
    );

  }

  // ===================================================
  // VALIDATE UPI
  // ===================================================

  if (!upiId) {

    throw new Error(
      "UPI ID is required."
    );

  }

  const safeUpi =
    String(
      upiId
    )
      .trim();

  // ===================================================
  // BASIC UPI VALIDATION
  // ===================================================

  if (
    !safeUpi.includes("@")
  ) {

    throw new Error(
      "Invalid UPI ID."
    );

  }

  // ===================================================
  // PAYLOAD
  // ===================================================

  const payload = {

    contact_id:
      contactId,

    account_type:
      "vpa",

    vpa: {

      address:
        safeUpi,

    },

  };

  // ===================================================
  // LOG
  // ===================================================

  console.log(
    "Creating Razorpay TEST VPA fund account:",
    {

      contactId,

      upiId:
        maskUpi(
          safeUpi
        ),

    }
  );

  // ===================================================
  // CREATE
  // ===================================================

  try {

    const response =
      await razorpayHttp.post(
        "/fund_accounts",
        payload
      );

    const fundAccount =
      response.data;

    console.log(
      "Razorpay TEST VPA fund account created:",
      {

        id:
          fundAccount.id,

        contactId:
          fundAccount.contact_id,

      }
    );

    return {

      id:
        fundAccount.id,

      contactId:
        fundAccount.contact_id,

      accountType:
        fundAccount.account_type,

      raw:
        fundAccount,

    };

  } catch (error) {

    logRazorpayError(
      "create VPA fund account",
      error
    );

    throw normalizeRazorpayError(
      "Unable to create Razorpay TEST VPA fund account.",
      error
    );

  }

}

// =====================================================
// CREATE TEST PAYOUT
// =====================================================

async function createTestPayout({

  accountNumber,

  fundAccountId,

  amountInr,

  referenceId,

}) {

  // ===================================================
  // VALIDATE ACCOUNT
  // ===================================================

  if (!accountNumber) {

    throw new Error(
      "RAZORPAY_ACCOUNT_NUMBER is missing."
    );

  }

  // ===================================================
  // VALIDATE FUND ACCOUNT
  // ===================================================

  if (!fundAccountId) {

    throw new Error(
      "Razorpay fund account ID is required."
    );

  }

  // ===================================================
  // VALIDATE AMOUNT
  // ===================================================

  if (

    amountInr === undefined ||

    amountInr === null ||

    Number(amountInr) <= 0

  ) {

    throw new Error(
      "Invalid payout amount."
    );

  }

  // ===================================================
  // VALIDATE REFERENCE
  // ===================================================

  if (!referenceId) {

    throw new Error(
      "Payout reference ID is required."
    );

  }

  // ===================================================
  // CONVERT INR -> PAISE
  // ===================================================

  const amount =
    Math.round(
      Number(amountInr) * 100
    );

  if (amount < 100) {

    throw new Error(
      "Razorpay payout amount must be at least ₹1."
    );

  }

  // ===================================================
  // IDEMPOTENCY
  // ===================================================

  const idempotencyKey =
    crypto.randomUUID();

  // ===================================================
  // SAFE REFERENCE
  // ===================================================

  const safeReference =
    String(
      referenceId
    )
      .replace(
        /[^a-zA-Z0-9_-]/g,
        ""
      )
      .slice(
        0,
        40
      );

  // ===================================================
  // PAYLOAD
  // ===================================================

  const payload = {

    account_number:
      accountNumber,

    fund_account_id:
      fundAccountId,

    amount,

    currency:
      "INR",

    mode:
      "UPI",

    purpose:
      "payout",

    queue_if_low_balance:
      true,

    reference_id:
      safeReference,

    narration:
      "Kudos Reward",

    notes: {

      source:
        "kudos",

      redemption_id:
        safeReference,

    },

  };

  // ===================================================
  // LOG
  // ===================================================

  console.log(
    "Creating Razorpay TEST payout:",
    {

      amountInr,

      amountPaise:
        amount,

      fundAccountId,

      referenceId:
        safeReference,

    }
  );

  // ===================================================
  // CREATE PAYOUT
  // ===================================================

  try {

    const response =
      await razorpayHttp.post(

        "/payouts",

        payload,

        {

          headers: {

            "X-Payout-Idempotency":
              idempotencyKey,

          },

        }

      );

    const payout =
      response.data;

    console.log(
      "Razorpay TEST payout created:",
      {

        id:
          payout.id,

        status:
          payout.status,

        referenceId:
          payout.reference_id,

      }
    );

    return {

      payoutId:
        payout.id,

      payoutStatus:
        payout.status,

      contactId:
        null,

      fundAccountId:
        payout.fund_account_id,

      referenceId:
        payout.reference_id,

      raw:
        payout,

    };

  } catch (error) {

    logRazorpayError(
      "create payout",
      error
    );

    throw normalizeRazorpayError(
      "Unable to create Razorpay TEST payout.",
      error
    );

  }

}

// =====================================================
// COMPLETE TEST UPI PAYOUT
// =====================================================
//
// Flow:
//
// Contact
//    ↓
// VPA Fund Account
//    ↓
// Payout
//
// =====================================================

async function createTestUpiPayout({

  recipientName,

  recipientEmail,

  upiId,

  amountInr,

  referenceId,

}) {

  console.log(
    "Starting Razorpay TEST UPI payout:",
    {

      recipientName:
        normalizeRecipientName(
          recipientName
        ),

      recipientEmail,

      upiId:
        maskUpi(
          upiId
        ),

      amountInr,

      referenceId,

    }
  );

  // ===================================================
  // 1. CREATE CONTACT
  // ===================================================

  const contact =
    await createTestContact({

      recipientName,

      recipientEmail,

      referenceId,

    });

  // ===================================================
  // 2. CREATE VPA FUND ACCOUNT
  // ===================================================

  const fundAccount =
    await createTestVpaFundAccount({

      contactId:
        contact.id,

      upiId,

    });

  // ===================================================
  // 3. CREATE PAYOUT
  // ===================================================

  const payout =
    await createTestPayout({

      accountNumber:
        ACCOUNT_NUMBER,

      fundAccountId:
        fundAccount.id,

      amountInr,

      referenceId,

    });

  // ===================================================
  // RETURN
  // ===================================================

  return {

    payoutId:
      payout.payoutId,

    payoutStatus:
      payout.payoutStatus,

    contactId:
      contact.id,

    fundAccountId:
      fundAccount.id,

    referenceId:
      payout.referenceId,

    raw:
      payout.raw,

  };

}

// =====================================================
// MASK UPI FOR LOGGING
// =====================================================

function maskUpi(
  upi
) {

  if (!upi) {

    return "***";

  }

  const value =
    String(
      upi
    );

  const index =
    value.indexOf("@");

  if (index <= 0) {

    return "***";

  }

  const name =
    value.substring(
      0,
      index
    );

  const domain =
    value.substring(
      index
    );

  if (
    name.length <= 2
  ) {

    return `**${domain}`;

  }

  return (

    name.substring(
      0,
      2
    ) +

    "***" +

    domain

  );

}

// =====================================================
// RAZORPAY ERROR LOGGING
// =====================================================

function logRazorpayError(
  operation,
  error
) {

  console.error(
    `Razorpay TEST ${operation} failed:`,
    {

      status:
        error.response?.status,

      data:
        error.response?.data,

      message:
        error.message,

    }
  );

}

// =====================================================
// NORMALIZE RAZORPAY ERROR
// =====================================================

function normalizeRazorpayError(
  fallback,
  error
) {

  const razorpayError =
    error.response?.data?.error;

  const description =
    razorpayError?.description ||

    error.response?.data?.message ||

    error.message;

  const normalized =
    new Error(
      description ||
      fallback
    );

  normalized.code =
    razorpayError?.code ||
    "RAZORPAY_TEST_ERROR";

  normalized.status =
    error.response?.status;

  normalized.razorpay =
    error.response?.data;

  return normalized;

}

// =====================================================
// EXPORT
// =====================================================

module.exports = {

  createTestContact,

  createTestVpaFundAccount,

  createTestPayout,

  createTestUpiPayout,

};
