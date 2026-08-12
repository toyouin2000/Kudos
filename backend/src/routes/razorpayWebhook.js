const express = require("express");
const crypto = require("crypto");

const supabase =
  require("../db/supabase");

const {
  sendPayoutStatusEmail,
} = require("../services/rewardEmailService");


const router =
  express.Router();


// =====================================================
// VERIFY RAZORPAY WEBHOOK SIGNATURE
// =====================================================

function verifyWebhookSignature(
  rawBody,
  signature,
  secret
) {

  if (!rawBody) {
    return false;
  }

  if (!signature) {
    return false;
  }

  if (!secret) {

    throw new Error(
      "RAZORPAY_WEBHOOK_SECRET is missing."
    );

  }


  const expectedSignature =
    crypto
      .createHmac(
        "sha256",
        secret
      )
      .update(rawBody)
      .digest("hex");


  // Prevent timingSafeEqual from throwing
  // when the lengths differ.

  if (
    expectedSignature.length !==
    signature.length
  ) {

    return false;

  }


  return crypto.timingSafeEqual(

    Buffer.from(
      expectedSignature,
      "utf8"
    ),

    Buffer.from(
      signature,
      "utf8"
    )

  );

}


// =====================================================
// GET USER DETAILS
// =====================================================

async function getRedemptionUser(
  userId
) {

  if (!userId) {

    return null;

  }


  const {
    data: user,
    error,
  } = await supabase

    .from("users")

    .select(
      "id, name, email"
    )

    .eq(
      "id",
      userId
    )

    .maybeSingle();


  if (error) {

    console.error(
      "Failed to fetch redemption user:",
      error
    );

    throw error;

  }


  return user;

}


// =====================================================
// SEND TRANSACTION EMAIL
// =====================================================

async function sendTransactionEmail({

  redemption,

  user,

  status,

  payoutId,

  referenceId,

}) {

  if (!user?.email) {

    console.warn(
      "Cannot send reward email: user email missing.",
      {
        redemptionId:
          redemption.id,

        userId:
          redemption.user_id,

      }
    );

    return;

  }


  try {

    await sendPayoutStatusEmail({

      recipientEmail:
        user.email,

      recipientName:
        user.name,

      amountInr:
        redemption.amount_inr,

      points:
        redemption.points,

      // IMPORTANT:
      // We intentionally do NOT store or expose
      // the employee's actual UPI ID.

      upiId:
        null,

      status,

      payoutId,

      referenceId,

      transactionDate:
        new Date(),

    });


    console.log(
      "Reward transaction email sent:",
      {

        recipientEmail:
          user.email,

        cc:
          process.env.REWARD_STATUS_CC_EMAIL ||
          "testdishank@gmail.com",

        status,

        redemptionId:
          redemption.id,

        payoutId,

      }
    );


  } catch (emailError) {

    // Email failure should NEVER change
    // the financial transaction state.

    console.error(
      "Failed to send reward transaction email:",
      emailError
    );

  }

}


// =====================================================
// WEBHOOK
// =====================================================
//
// POST /api/webhooks/razorpay
//
// IMPORTANT:
// This endpoint must receive the RAW request body.
// =====================================================

router.post(
  "/razorpay",
  async (req, res) => {

    try {

      // =================================================
      // SIGNATURE
      // =================================================

      const signature =
        req.headers[
          "x-razorpay-signature"
        ];


      const webhookSecret =
        process.env
          .RAZORPAY_WEBHOOK_SECRET;


      // =================================================
      // RAW BODY
      // =================================================

      const rawBody =
        Buffer.isBuffer(
          req.body
        )

          ? req.body

          : Buffer.from(
              req.body || ""
            );


      // =================================================
      // VERIFY SIGNATURE
      // =================================================

      const valid =
        verifyWebhookSignature(

          rawBody,

          signature,

          webhookSecret

        );


      if (!valid) {

        console.error(
          "Invalid Razorpay webhook signature."
        );


        return res.status(400).json({

          error:
            "INVALID_WEBHOOK_SIGNATURE",

        });

      }


      // =================================================
      // PARSE PAYLOAD
      // =================================================

      let event;


      try {

        event =
          JSON.parse(
            rawBody.toString(
              "utf8"
            )
          );

      } catch (parseError) {

        console.error(
          "Invalid Razorpay webhook JSON:",
          parseError
        );


        return res.status(400).json({

          error:
            "INVALID_WEBHOOK_PAYLOAD",

        });

      }


      const eventName =
        event.event;


      console.log(
        "Razorpay webhook received:",
        eventName
      );


      // =================================================
      // EXTRACT PAYOUT
      // =================================================

      const payout =
        event
          ?.payload
          ?.payout
          ?.entity;


      if (!payout) {

        console.log(
          "Webhook does not contain payout entity."
        );


        return res.status(200).json({

          received:
            true,

          ignored:
            true,

        });

      }


      const payoutId =
        payout.id;


      const referenceId =
        payout.reference_id;


      const providerStatus =
        payout.status;


      console.log(
        "Razorpay payout webhook:",
        {

          event:
            eventName,

          payoutId,

          referenceId,

          status:
            providerStatus,

        }
      );


      // =================================================
      // FIND REDEMPTION
      // =================================================
      //
      // First try payout ID.
      //
      // If the webhook arrives immediately after payout
      // creation but before we save payout ID in our DB,
      // fallback to reference_id.
      // =================================================

      let redemption =
        null;


      if (payoutId) {

        const {
          data,
          error,
        } = await supabase

          .from("redemptions")

          .select("*")

          .eq(
            "razorpay_payout_id",
            payoutId
          )

          .maybeSingle();


        if (error) {

          console.error(
            "Failed to find redemption by payout ID:",
            error
          );


          return res.status(500).json({

            error:
              "DATABASE_ERROR",

          });

        }


        redemption =
          data;

      }


      // =================================================
      // FALLBACK: REFERENCE ID
      // =================================================
      //
      // Our reference_id is the redemption UUID.
      // =================================================

      if (
        !redemption &&
        referenceId
      ) {

        const {
          data,
          error,
        } = await supabase

          .from("redemptions")

          .select("*")

          .eq(
            "id",
            referenceId
          )

          .maybeSingle();


        if (error) {

          console.error(
            "Failed to find redemption by reference ID:",
            error
          );


          return res.status(500).json({

            error:
              "DATABASE_ERROR",

          });

        }


        redemption =
          data;

      }


      // =================================================
      // UNKNOWN PAYOUT
      // =================================================

      if (!redemption) {

        console.warn(
          "No redemption found for Razorpay payout:",
          {

            payoutId,

            referenceId,

          }
        );


        // Acknowledge webhook.
        // Razorpay doesn't need to retry an event
        // that doesn't belong to our system.

        return res.status(200).json({

          received:
            true,

          matched:
            false,

        });

      }


      // =================================================
      // USER
      // =================================================

      const user =
        await getRedemptionUser(
          redemption.user_id
        );


      console.log(
        "Redemption matched:",
        {

          redemptionId:
            redemption.id,

          userId:
            redemption.user_id,

          userEmail:
            user?.email,

          currentStatus:
            redemption.status,

          currentProviderStatus:
            redemption.provider_status,

          payoutId,

          providerStatus,

        }
      );


      // =================================================
      // PAYOUT PROCESSED
      // =====================================================
      //
      // Razorpay:
      //
      // processing → processed
      //
      // Our DB:
      //
      // sent → claimed
      //
      // Email:
      //
      // SUCCESS
      // =====================================================

      if (
        eventName ===
          "payout.processed" ||

        providerStatus ===
          "processed"
      ) {


        // -----------------------------------------------
        // DUPLICATE WEBHOOK
        // -----------------------------------------------

        if (
          redemption.status ===
            "claimed" &&

          redemption.provider_status ===
            "processed"
        ) {

          console.log(
            "Duplicate payout.processed webhook ignored:",
            redemption.id
          );


          return res.status(200).json({

            received:
              true,

            duplicate:
              true,

          });

        }


        // -----------------------------------------------
        // UPDATE DATABASE
        // -----------------------------------------------

        const {
          data: updated,
          error:
            updateError,
        } = await supabase

          .from("redemptions")

          .update({

            status:
              "claimed",

            provider_status:
              "processed",

            claimed_at:
              redemption.claimed_at ||

              new Date()
                .toISOString(),

            updated_at:
              new Date()
                .toISOString(),

          })

          .eq(
            "id",
            redemption.id
          )

          .in(
            "status",
            [
              "sent",
              "claimed",
            ]
          )

          .select()
          .maybeSingle();


        if (updateError) {

          console.error(
            "Failed to mark redemption as claimed:",
            updateError
          );


          return res.status(500).json({

            error:
              "DATABASE_UPDATE_FAILED",

          });

        }


        // -----------------------------------------------
        // NO UPDATE = DUPLICATE / ALREADY PROCESSED
        // -----------------------------------------------

        if (!updated) {

          console.log(
            "Redemption already processed:",
            redemption.id
          );


          return res.status(200).json({

            received:
              true,

            duplicate:
              true,

          });

        }


        console.log(
          "Redemption marked as CLAIMED:",
          {

            redemptionId:
              redemption.id,

            payoutId,

          }
        );


        // -----------------------------------------------
        // SUCCESS EMAIL
        // -----------------------------------------------

        await sendTransactionEmail({

          redemption,

          user,

          status:
            "claimed",

          payoutId,

          referenceId,

        });


        return res.status(200).json({

          received:
            true,

          processed:
            true,

          status:
            "claimed",

        });

      }


      // =================================================
      // PAYOUT FAILED
      // =====================================================
      //
      // Our DB:
      //
      // sent → failed
      //
      // Email:
      //
      // FAILURE
      // =====================================================

      if (
        eventName ===
        "payout.failed"
      ) {

        const failureReason =
          payout
            ?.status_details
            ?.description ||

          payout
            ?.error
            ?.description ||

          "Razorpay payout failed.";


        // -----------------------------------------------
        // DUPLICATE FAILURE
        // -----------------------------------------------

        if (
          redemption.status ===
            "failed" &&

          redemption.provider_status ===
            "failed"
        ) {

          console.log(
            "Duplicate payout.failed webhook ignored:",
            redemption.id
          );


          return res.status(200).json({

            received:
              true,

            duplicate:
              true,

          });

        }


        // -----------------------------------------------
        // UPDATE DATABASE
        // -----------------------------------------------

        const {
          data: updated,
          error:
            updateError,
        } = await supabase

          .from("redemptions")

          .update({

            status:
              "failed",

            provider_status:
              "failed",

            failure_reason:
              failureReason,

            updated_at:
              new Date()
                .toISOString(),

          })

          .eq(
            "id",
            redemption.id
          )

          .in(
            "status",
            [
              "sent",
              "failed",
            ]
          )

          .select()
          .maybeSingle();


        if (updateError) {

          console.error(
            "Failed to mark redemption as failed:",
            updateError
          );


          return res.status(500).json({

            error:
              "DATABASE_UPDATE_FAILED",

          });

        }


        if (!updated) {

          console.log(
            "Payout failure already processed:",
            redemption.id
          );


          return res.status(200).json({

            received:
              true,

            duplicate:
              true,

          });

        }


        console.log(
          "Redemption marked as FAILED:",
          {

            redemptionId:
              redemption.id,

            payoutId,

            reason:
              failureReason,

          }
        );


        // -----------------------------------------------
        // FAILURE EMAIL
        // -----------------------------------------------

        await sendTransactionEmail({

          redemption,

          user,

          status:
            "failed",

          payoutId,

          referenceId,

        });


        return res.status(200).json({

          received:
            true,

          processed:
            true,

          status:
            "failed",

        });

      }


      // =================================================
      // PAYOUT REVERSED
      // =====================================================
      //
      // Current test policy:
      //
      // reversed → failed
      // =====================================================

      if (
        eventName ===
        "payout.reversed"
      ) {

        // -----------------------------------------------
        // DUPLICATE REVERSAL
        // -----------------------------------------------

        if (
          redemption.status ===
            "failed" &&

          redemption.provider_status ===
            "reversed"
        ) {

          console.log(
            "Duplicate payout.reversed webhook ignored:",
            redemption.id
          );


          return res.status(200).json({

            received:
              true,

            duplicate:
              true,

          });

        }


        // -----------------------------------------------
        // UPDATE DATABASE
        // -----------------------------------------------

        const {
          data: updated,
          error:
            updateError,
        } = await supabase

          .from("redemptions")

          .update({

            status:
              "failed",

            provider_status:
              "reversed",

            failure_reason:
              "Razorpay payout was reversed.",

            updated_at:
              new Date()
                .toISOString(),

          })

          .eq(
            "id",
            redemption.id
          )

          .in(
            "status",
            [
              "sent",
              "claimed",
              "failed",
            ]
          )

          .select()
          .maybeSingle();


        if (updateError) {

          console.error(
            "Failed to mark reversed redemption:",
            updateError
          );


          return res.status(500).json({

            error:
              "DATABASE_UPDATE_FAILED",

          });

        }


        if (!updated) {

          console.log(
            "Reversal already processed:",
            redemption.id
          );


          return res.status(200).json({

            received:
              true,

            duplicate:
              true,

          });

        }


        console.log(
          "Redemption marked as FAILED after reversal:",
          {

            redemptionId:
              redemption.id,

            payoutId,

          }
        );


        // -----------------------------------------------
        // REVERSAL EMAIL
        // -----------------------------------------------

        await sendTransactionEmail({

          redemption,

          user,

          status:
            "reversed",

          payoutId,

          referenceId,

        });


        return res.status(200).json({

          received:
            true,

          processed:
            true,

          status:
            "failed",

        });

      }


      // =================================================
      // PROCESSING / QUEUED / OTHER PAYOUT EVENTS
      // =====================================================
      //
      // Example:
      //
      // processing
      //
      // Our DB remains:
      //
      // sent
      //
      // But provider_status is updated.
      //
      // Email is sent because the provider status changed.
      // =====================================================

      const oldProviderStatus =
        redemption.provider_status;


      const providerStatusChanged =
        oldProviderStatus !==
        providerStatus;


      // -----------------------------------------------
      // UPDATE PROVIDER STATUS
      // -----------------------------------------------

      const {
        data: updated,
        error:
          statusUpdateError,
      } = await supabase

        .from("redemptions")

        .update({

          provider_status:
            providerStatus,

          updated_at:
            new Date()
              .toISOString(),

        })

        .eq(
          "id",
          redemption.id
        )

        .select()
        .maybeSingle();


      if (
        statusUpdateError
      ) {

        console.error(
          "Failed to update provider status:",
          statusUpdateError
        );


        return res.status(500).json({

          error:
            "DATABASE_UPDATE_FAILED",

        });

      }


      // -----------------------------------------------
      // EMAIL ONLY WHEN PROVIDER STATUS CHANGED
      // -----------------------------------------------

      if (
        updated &&
        providerStatusChanged
      ) {

        console.log(
          "Provider status changed:",
          {

            redemptionId:
              redemption.id,

            oldStatus:
              oldProviderStatus,

            newStatus:
              providerStatus,

          }
        );


        await sendTransactionEmail({

          redemption,

          user,

          status:
            providerStatus,

          payoutId,

          referenceId,

        });

      }


      return res.status(200).json({

        received:
          true,

        processed:
          true,

        status:
          providerStatus,

      });


    } catch (error) {

      console.error(
        "Razorpay webhook error:",
        error
      );


      return res.status(500).json({

        error:
          "INTERNAL_SERVER_ERROR",

      });

    }

  }
);


// =====================================================
// EXPORT
// =====================================================

module.exports =
  router;