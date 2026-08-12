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
// CREATE CONTACT
// =====================================================

async function createTestContact({

  recipientName,

  recipientEmail,

  referenceId,

}) {

  if (!recipientName) {

    throw new Error(
      "Recipient name is required."
    );

  }


  if (!recipientEmail) {

    throw new Error(
      "Recipient email is required."
    );

  }


  if (!referenceId) {

    throw new Error(
      "Reference ID is required."
    );

  }


  // Razorpay reference_id has a max length of 40.
  const safeReference =
    String(referenceId)
      .replace(
        /[^a-zA-Z0-9_-]/g,
        ""
      )
      .slice(0, 40);


  const payload = {

    name:
      recipientName
        .trim()
        .slice(0, 50),

    email:
      recipientEmail
        .trim()
        .toLowerCase(),

    type:
      "employee",

    reference_id:
      safeReference,

  };


  console.log(
    "Creating Razorpay TEST contact:",
    {
      name:
        payload.name,

      email:
        payload.email,

      referenceId:
        payload.reference_id,

    }
  );


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
// We do NOT save it in Supabase.
// =====================================================

async function createTestVpaFundAccount({

  contactId,

  upiId,

}) {

  if (!contactId) {

    throw new Error(
      "Razorpay contact ID is required."
    );

  }


  if (!upiId) {

    throw new Error(
      "UPI ID is required."
    );

  }


  const payload = {

    contact_id:
      contactId,

    account_type:
      "vpa",

    vpa: {

      address:
        upiId,

    },

  };


  console.log(
    "Creating Razorpay TEST VPA fund account:",
    {
      contactId,

      upiId:
        maskUpi(
          upiId
        ),

    }
  );


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

  if (!accountNumber) {

    throw new Error(
      "RAZORPAY_ACCOUNT_NUMBER is missing."
    );

  }


  if (!fundAccountId) {

    throw new Error(
      "Razorpay fund account ID is required."
    );

  }


  if (
    amountInr === undefined ||
    amountInr === null ||
    Number(amountInr) <= 0
  ) {

    throw new Error(
      "Invalid payout amount."
    );

  }


  if (!referenceId) {

    throw new Error(
      "Payout reference ID is required."
    );

  }


  const amount =
    Math.round(
      Number(amountInr) * 100
    );


  if (amount < 100) {

    throw new Error(
      "Razorpay payout amount must be at least ₹1."
    );

  }


  const idempotencyKey =
    crypto.randomUUID();


  const safeReference =
    String(referenceId)
      .replace(
        /[^a-zA-Z0-9_-]/g,
        ""
      )
      .slice(0, 40);


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
// The UPI ID is NEVER returned to our database.
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

      recipientName,

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
    String(upi);


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
// NORMALIZE ERROR
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