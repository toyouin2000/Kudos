const supabase =
  require("../db/supabase");

const {
  createPayoutLink,
} = require("./razorpayService");


// =====================================================
// GET ORGANIZATION REWARD CONFIG
// =====================================================

async function getRewardConfig(
  organizationId
) {

  const {
    data,
    error,
  } = await supabase
    .from(
      "organization_reward_config"
    )
    .select(`
      id,
      organization_id,
      monthly_reward_points,
      point_value_inr,
      minimum_redemption_inr,
      payout_link_expiry_days,
      expired_payout_behavior
    `)
    .eq(
      "organization_id",
      organizationId
    )
    .single();


  if (error) {

    throw new Error(
      `Reward configuration not found: ${error.message}`
    );

  }


  return data;

}


// =====================================================
// GET USER
// =====================================================

async function getUser({
  organizationId,
  userId,
}) {

  const {
    data,
    error,
  } = await supabase

    .from("users")

    .select(`
      id,
      organization_id,
      name,
      email,
      received_balance,
      reward_balance,
      is_active
    `)

    .eq(
      "id",
      userId
    )

    .eq(
      "organization_id",
      organizationId
    )

    .eq(
      "is_active",
      true
    )

    .maybeSingle();


  if (error) {

    throw new Error(
      `Unable to fetch user: ${error.message}`
    );

  }


  if (!data) {

    throw new Error(
      "USER_NOT_FOUND"
    );

  }


  return data;

}


// =====================================================
// GET REDEMPTION MONTH
// =====================================================
//
// Uses IST.
//
// Example:
//
// 2026-08-12 -> 2026-08-01
//
// =====================================================

function getRedemptionMonth() {

  const formatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "Asia/Kolkata",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",
      }
    );


  const parts =
    formatter.formatToParts(
      new Date()
    );


  const year =
    parts.find(
      (part) =>
        part.type === "year"
    ).value;


  const month =
    parts.find(
      (part) =>
        part.type === "month"
    ).value;


  return `${year}-${month}-01`;

}


// =====================================================
// CREATE IDEMPOTENCY KEY
// =====================================================

function createIdempotencyKey({
  organizationId,
  userId,
  redemptionMonth,
}) {

  return [

    "kudos",

    "redemption",

    organizationId,

    userId,

    redemptionMonth,

  ].join(":");

}


// =====================================================
// CALCULATE REDEMPTION
// =====================================================

function calculateRedemption({
  points,
  pointValueInr,
  minimumRedemptionInr,
}) {

  const amountInr =
    Number(points) *
    Number(pointValueInr);


  return {

    points,

    conversionRate:
      Number(
        pointValueInr
      ),

    amountInr,

    eligible:
      amountInr >=
      Number(
        minimumRedemptionInr
      ),

  };

}


// =====================================================
// GET EXISTING REDEMPTION
// =====================================================

async function getExistingRedemption({
  organizationId,
  userId,
  redemptionMonth,
}) {

  const {
    data,
    error,
  } = await supabase

    .from("redemptions")

    .select(`
      id,
      organization_id,
      user_id,
      redemption_month,
      points,
      conversion_rate,
      amount_inr,
      status,
      razorpay_payout_link_id,
      razorpay_reference_id,
      payout_link,
      expires_at,
      claimed_at,
      failed_at,
      failure_reason,
      idempotency_key,
      created_at,
      updated_at
    `)

    .eq(
      "organization_id",
      organizationId
    )

    .eq(
      "user_id",
      userId
    )

    .eq(
      "redemption_month",
      redemptionMonth
    )

    .maybeSingle();


  if (error) {

    throw new Error(
      `Unable to check existing redemption: ${error.message}`
    );

  }


  return data;

}


// =====================================================
// AUDIT LOG
// =====================================================

async function createAuditLog({
  organizationId,
  userId,
  redemptionId,
  eventType,
  amountInr,
  providerReference,
  idempotencyKey,
  metadata,
}) {

  const {
    error,
  } = await supabase

    .from("payout_audit_logs")

    .insert({

      organization_id:
        organizationId,

      user_id:
        userId,

      redemption_id:
        redemptionId,

      event_type:
        eventType,

      amount_inr:
        amountInr ??
        null,

      provider:
        "razorpay",

      provider_reference:
        providerReference ??
        null,

      idempotency_key:
        idempotencyKey ??
        null,

      metadata:
        metadata ??
        {},

    });


  if (error) {

    console.error(
      "Payout audit log error:",
      error
    );

  }

}


// =====================================================
// RESERVE REDEMPTION
// =====================================================
//
// Supabase RPC performs the operation atomically:
//
// 1. Lock user
// 2. Check balance
// 3. Check existing redemption
// 4. Check minimum threshold
// 5. Create pending redemption
// 6. Set received_balance = 0
//
// =====================================================

async function reserveRedemption({
  organizationId,
  userId,
}) {

  if (
    !organizationId ||
    !userId
  ) {

    throw new Error(
      "organizationId and userId are required."
    );

  }


  const config =
    await getRewardConfig(
      organizationId
    );


  const redemptionMonth =
    getRedemptionMonth();


  const idempotencyKey =
    createIdempotencyKey({

      organizationId,

      userId,

      redemptionMonth,

    });


  const {
    data,
    error,
  } = await supabase.rpc(

    "reserve_redemption_points",

    {

      p_organization_id:
        organizationId,

      p_user_id:
        userId,

      p_redemption_month:
        redemptionMonth,

      p_conversion_rate:
        Number(
          config.point_value_inr
        ),

      p_minimum_redemption_inr:
        Number(
          config.minimum_redemption_inr
        ),

      p_idempotency_key:
        idempotencyKey,

    }

  );


  if (error) {

    console.error(
      "Redemption reservation error:",
      error
    );


    throw new Error(
      error.message
    );

  }


  return {

    config,

    redemptionMonth,

    idempotencyKey,

    result:
      data,

  };

}


// =====================================================
// RESTORE FAILED REDEMPTION
// =====================================================
//
// Called when Razorpay payout creation fails BEFORE
// the payout is successfully created.
//
// =====================================================

async function restoreFailedRedemption({
  redemptionId,
  reason,
}) {

  const {
    data,
    error,
  } = await supabase.rpc(

    "fail_redemption_and_restore_points",

    {

      p_redemption_id:
        redemptionId,

      p_failure_reason:
        reason ||
        "Payout creation failed",

    }

  );


  if (error) {

    console.error(
      "Failed to restore redemption:",
      error
    );


    throw error;

  }


  return data;

}


// =====================================================
// PREPARE REDEMPTION
// =====================================================

async function prepareRedemption({
  organizationId,
  userId,
}) {

  const reservation =
    await reserveRedemption({

      organizationId,

      userId,

    });


  const {
    config,
    redemptionMonth,
    idempotencyKey,
    result,
  } =
    reservation;


  // ===================================================
  // EXISTING REDEMPTION
  // ===================================================

  if (
    result.already_exists
  ) {

    const existing =
      await getExistingRedemption({

        organizationId,

        userId,

        redemptionMonth,

      });


    return {

      alreadyExists:
        true,

      redemption:
        existing,

      config,

    };

  }


  // ===================================================
  // BELOW MINIMUM
  // ===================================================

  if (
    result.eligible === false
  ) {

    return {

      eligible:
        false,

      points:
        result.points,

      amountInr:
        result.amount_inr,

      minimumRedemptionInr:
        Number(
          result.minimum_redemption_inr
        ),

      config,

    };

  }


  // ===================================================
  // SUCCESSFUL RESERVATION
  // ===================================================

  if (
    result.success
  ) {

    const user =
      await getUser({

        organizationId,

        userId,

      });


    const redemption =
      await getExistingRedemption({

        organizationId,

        userId,

        redemptionMonth,

      });


    if (!redemption) {

      throw new Error(
        "Redemption was created but could not be retrieved."
      );

    }


    await createAuditLog({

      organizationId,

      userId,

      redemptionId:
        redemption.id,

      eventType:
        "REDEMPTION_RESERVED",

      amountInr:
        redemption.amount_inr,

      idempotencyKey,

      metadata: {

        points:
          redemption.points,

        conversionRate:
          redemption.conversion_rate,

        redemptionMonth,

      },

    });


    return {

      alreadyExists:
        false,

      eligible:
        true,

      redemption,

      user,

      config,

    };

  }


  throw new Error(
    "Unable to reserve redemption."
  );

}


// =====================================================
// CREATE RAZORPAY TEST PAYOUT
// =====================================================
//
// NOTE:
//
// Despite the historical function name
// `generatePayoutLink`, this currently creates a
// RazorpayX TEST PAYOUT.
//
// We keep the function name temporarily so existing
// routes/controllers do not break.
//
// =====================================================

async function generatePayoutLink({
  organizationId,
  userId,
}) {

  // ===================================================
  // RESERVE BALANCE
  // ===================================================

  const prepared =
    await prepareRedemption({

      organizationId,

      userId,

    });


  // ===================================================
  // EXISTING REDEMPTION
  // ===================================================

  if (
    prepared.alreadyExists
  ) {

    return {

      success:
        true,

      redemption:
        prepared.redemption,

      alreadyExists:
        true,

    };

  }


  // ===================================================
  // BELOW MINIMUM
  // ===================================================

  if (
    prepared.eligible === false
  ) {

    await createAuditLog({

      organizationId,

      userId,

      redemptionId:
        null,

      eventType:
        "REDEMPTION_BELOW_THRESHOLD",

      amountInr:
        prepared.amountInr,

      metadata: {

        points:
          prepared.points,

        minimumRedemptionInr:
          prepared.minimumRedemptionInr,

      },

    });


    return prepared;

  }


  const {
    redemption,
    user,
    config,
  } =
    prepared;


  // ===================================================
  // CREATE RAZORPAY TEST PAYOUT
  // ===================================================

  try {

    console.log(
      "Creating Razorpay TEST payout:",
      {

        redemptionId:
          redemption.id,

        userId:
          user.id,

        amountInr:
          redemption.amount_inr,

        email:
          user.email,

      }
    );


    const payout =
      await createPayoutLink({

        amountInr:
          redemption.amount_inr,

        referenceId:
          redemption.id,

        description:
          `Kudos reward for ${user.name}`,

        // Kept for compatibility with the
        // Razorpay service signature.
        expiryDays:
          config.payout_link_expiry_days,

        idempotencyKey:
          redemption.idempotency_key,

        recipientName:
          user.name,

        recipientEmail:
          user.email,

        recipientPhone:
          null,

      });


    // =================================================
    // UPDATE REDEMPTION
    // =================================================
    //
    // Test Payout does not provide a hosted
    // `short_url`.
    //
    // Therefore payout_link remains NULL.
    //
    // `razorpay_payout_link_id` is temporarily used
    // to store the provider payout ID because your
    // current schema already has this column.
    //
    // Ideally rename this column later to:
    //
    // razorpay_payout_id
    //
    // =================================================

    const {
      data:
        updatedRedemption,

      error:
        updateError,

    } = await supabase

      .from("redemptions")

      .update({

        status:
          payout.status ||
          "processing",

        razorpay_payout_link_id:
          payout.id,

        razorpay_reference_id:
          payout.referenceId,

        payout_link:
          null,

        expires_at:
          null,

        updated_at:
          new Date().toISOString(),

      })

      .eq(
        "id",
        redemption.id
      )

      .select()

      .single();


    // =================================================
    // DATABASE UPDATE FAILED
    // =================================================

    if (
      updateError
    ) {

      console.error(
        "Redemption database update failed after Razorpay payout creation:",
        updateError
      );


      /*
       * VERY IMPORTANT
       *
       * Razorpay already created the payout.
       *
       * DO NOT restore the points automatically.
       *
       * Otherwise:
       *
       * Razorpay payout = ₹730
       * User balance = restored 73
       *
       * This creates a potential double payout.
       *
       * We instead log it for reconciliation.
       */

      await createAuditLog({

        organizationId,

        userId,

        redemptionId:
          redemption.id,

        eventType:
          "PAYOUT_CREATED_DB_UPDATE_FAILED",

        amountInr:
          redemption.amount_inr,

        providerReference:
          payout.id,

        idempotencyKey:
          redemption.idempotency_key,

        metadata: {

          error:
            updateError.message,

          payout,

        },

      });


      throw new Error(
        "PAYOUT_CREATED_BUT_DATABASE_UPDATE_FAILED"
      );

    }


    // =================================================
    // AUDIT
    // =================================================

    await createAuditLog({

      organizationId,

      userId,

      redemptionId:
        redemption.id,

      eventType:
        "PAYOUT_CREATED",

      amountInr:
        redemption.amount_inr,

      providerReference:
        payout.id,

      idempotencyKey:
        redemption.idempotency_key,

      metadata: {

        razorpayStatus:
          payout.status,

        referenceId:
          payout.referenceId,

        mode:
          payout.mode ||
          "UPI",

        testMode:
          true,

      },

    });


    // =================================================
    // SUCCESS
    // =================================================

    return {

      success:
        true,

      testMode:
        true,

      redemption:
        updatedRedemption,

      user,

      payout: {

        id:
          payout.id,

        status:
          payout.status,

        referenceId:
          payout.referenceId,

        amount:
          payout.amount,

        currency:
          payout.currency,

        mode:
          payout.mode,

      },

    };

  } catch (error) {

    console.error(
      "Razorpay TEST payout creation failed:",
      error
    );


    // =================================================
    // DATABASE UPDATE FAILURE AFTER PAYOUT CREATED
    // =================================================
    //
    // Do NOT restore points.
    //
    // The payout already exists externally.
    //
    // =================================================

    const databaseUpdateFailure =
      error.message ===
      "PAYOUT_CREATED_BUT_DATABASE_UPDATE_FAILED";


    if (
      !databaseUpdateFailure
    ) {

      // ===============================================
      // RAZORPAY REQUEST FAILED
      // ===============================================
      //
      // Restore points because the payout was not
      // successfully created.
      //
      // ===============================================

      try {

        await restoreFailedRedemption({

          redemptionId:
            redemption.id,

          reason:
            error.message,

        });

      } catch (
        restoreError
      ) {

        console.error(
          "CRITICAL: Unable to restore points:",
          restoreError
        );


        await createAuditLog({

          organizationId,

          userId,

          redemptionId:
            redemption.id,

          eventType:
            "POINT_RESTORE_FAILED",

          amountInr:
            redemption.amount_inr,

          idempotencyKey:
            redemption.idempotency_key,

          metadata: {

            originalError:
              error.message,

            restoreError:
              restoreError.message,

          },

        });

      }

    }


    // =================================================
    // AUDIT FAILURE
    // =================================================

    await createAuditLog({

      organizationId,

      userId,

      redemptionId:
        redemption.id,

      eventType:
        databaseUpdateFailure
          ? "PAYOUT_CREATED_DB_UPDATE_FAILED"
          : "PAYOUT_CREATION_FAILED",

      amountInr:
        redemption.amount_inr,

      idempotencyKey:
        redemption.idempotency_key,

      metadata: {

        error:
          error.message,

        pointsRestored:
          !databaseUpdateFailure,

        testMode:
          true,

      },

    });


    throw error;

  }

}


// =====================================================
// EXPORTS
// =====================================================

module.exports = {

  getRewardConfig,

  getUser,

  getRedemptionMonth,

  calculateRedemption,

  getExistingRedemption,

  createAuditLog,

  reserveRedemption,

  restoreFailedRedemption,

  prepareRedemption,

  generatePayoutLink,

};