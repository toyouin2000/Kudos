const Razorpay = require("razorpay");


// =====================================================
// RAZORPAY TEST CLIENT
// =====================================================
//
// IMPORTANT:
//
// Use RazorpayX TEST MODE API credentials here.
//
// These credentials must be generated while your
// RazorpayX dashboard is in Test Mode.
//
// Test-mode payouts do NOT move real money.
// =====================================================

const razorpay = new Razorpay({

  key_id:
    process.env.RAZORPAY_KEY_ID,

  key_secret:
    process.env.RAZORPAY_KEY_SECRET,

});


// =====================================================
// VALIDATE CONFIG
// =====================================================

if (
  !process.env.RAZORPAY_KEY_ID ||
  !process.env.RAZORPAY_KEY_SECRET
) {

  console.warn(
    "WARNING: Razorpay test credentials are missing."
  );

}


if (
  !process.env.RAZORPAY_ACCOUNT_NUMBER
) {

  console.warn(
    "WARNING: RAZORPAY_ACCOUNT_NUMBER is missing."
  );

}


// =====================================================
// CREATE TEST PAYOUT
// =====================================================
//
// CURRENT DEVELOPMENT FLOW:
//
// Kudos
//   ↓
// Redemption
//   ↓
// RazorpayX Test Payout
//   ↓
// Test UPI / VPA
//
// This does NOT create a hosted Payout Link.
//
// Payout Links are not available in Razorpay Test Mode.
//
// =====================================================

async function createPayoutLink({

  amountInr,

  referenceId,

  description,

  expiryDays,

  idempotencyKey,

  recipientName,

  recipientEmail,

  recipientPhone,

}) {

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


  const numericAmount =
    Number(amountInr);


  if (
    !Number.isFinite(
      numericAmount
    )
  ) {

    throw new Error(
      "Invalid payout amount."
    );

  }


  // ===================================================
  // CONVERT INR → PAISE
  // ===================================================

  const amount =
    Math.round(
      numericAmount * 100
    );


  if (
    amount < 100
  ) {

    throw new Error(
      "Payout amount must be at least ₹1."
    );

  }


  // ===================================================
  // REFERENCE
  // ===================================================

  if (!referenceId) {

    throw new Error(
      "Payout reference ID is required."
    );

  }


  // Razorpay reference_id has a maximum length.
  const razorpayReference =
    String(referenceId)
      .slice(0, 40);


  // ===================================================
  // IDEMPOTENCY
  // ===================================================
  //
  // Razorpay requires:
  //
  // X-Payout-Idempotency
  //
  // for payout creation.
  //
  // Same key MUST be reused for retries of the
  // same payout.
  //
  // ===================================================

  if (!idempotencyKey) {

    throw new Error(
      "Payout idempotency key is required."
    );

  }


  const razorpayIdempotencyKey =
    String(idempotencyKey)
      .slice(0, 36);


  // ===================================================
  // ACCOUNT NUMBER
  // ===================================================
  //
  // This is YOUR RazorpayX Test Mode account/
  // customer identifier.
  //
  // It is NOT the employee's bank account.
  //
  // Test Mode has its own account identifier.
  //
  // ===================================================

  const accountNumber =
    process.env.RAZORPAY_ACCOUNT_NUMBER;


  if (!accountNumber) {

    throw new Error(
      "RAZORPAY_ACCOUNT_NUMBER is missing."
    );

  }


  // ===================================================
  // TEST VPA
  // ===================================================
  //
  // IMPORTANT:
  //
  // For Test Mode we need a test fund account.
  //
  // Put the VPA/fund account created in your
  // RazorpayX Test Mode environment here.
  //
  // Example:
  //
  // RAZORPAY_TEST_VPA=test@razorpay
  //
  // Do NOT put a real user's UPI ID here.
  //
  // ===================================================

  const testVpa =
    process.env.RAZORPAY_TEST_VPA;


  if (!testVpa) {

    throw new Error(
      "RAZORPAY_TEST_VPA is missing."
    );

  }


  // ===================================================
  // PAYLOAD
  // ===================================================

  const payload = {

    account_number:
      accountNumber,

    amount,

    currency:
      "INR",

    mode:
      "UPI",

    purpose:
      "payout",

    fund_account: {

      account_type:
        "vpa",

      vpa: {

        address:
          testVpa,

      },

    },

    reference_id:
      razorpayReference,

    narration:
      description ||
      "Kudos reward",

    notes: {

      source:
        "kudos",

      redemption_id:
        razorpayReference,

      recipient_email:
        recipientEmail ||
        "",

      recipient_name:
        recipientName ||
        "",

    },

  };


  // ===================================================
  // LOG
  // ===================================================

  console.log(
    "Creating Razorpay TEST payout:",
    {

      amountInr:
        numericAmount,

      amountPaise:
        amount,

      referenceId:
        razorpayReference,

      recipientEmail:
        recipientEmail ||
        null,

      recipientName:
        recipientName ||
        null,

      mode:
        "UPI",

      testMode:
        true,

    }
  );


  // ===================================================
  // CREATE PAYOUT
  // =====================================================
  //
  // POST /v1/payouts
  //
  // Razorpay documents X-Payout-Idempotency as
  // mandatory for payout requests.
  //
  // =====================================================

  let response;

  try {

    response =
      await razorpay.request({

        method:
          "POST",

        url:
          "/v1/payouts",

        headers: {

          "Content-Type":
            "application/json",

          "X-Payout-Idempotency":
            razorpayIdempotencyKey,

        },

        data:
          payload,

      });

  } catch (error) {

    console.error(
      "Razorpay TEST payout failed:",
      {

        message:
          error.message,

        statusCode:
          error.statusCode,

        error:
          error.error ||
          error.description ||
          null,

      }
    );


    throw error;

  }


  // ===================================================
  // NORMALIZE RESPONSE
  // ===================================================

  const payout =
    response;


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


  // ===================================================
  // RETURN
  // ===================================================

  return {

    id:
      payout.id,

    status:
      payout.status,

    referenceId:
      payout.reference_id,

    amount:
      payout.amount,

    currency:
      payout.currency,

    mode:
      payout.mode,

    fundAccountId:
      payout.fund_account_id,

    raw:
      payout,

  };

}


// =====================================================
// EXPORT
// =====================================================

module.exports = {

  createPayoutLink,

};