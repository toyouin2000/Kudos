const express = require("express");

const supabase = require("../db/supabase");

const {
  hashClaimToken,
} = require("../services/claimTokenService");

const {
  createTestUpiPayout,
} = require("../services/razorpayTestService");

const router = express.Router();


// =====================================================
// GET CLAIM DETAILS
// =====================================================
//
// GET /api/test-claims/:token
//
// Public endpoint.
// The claim token acts as the authorization mechanism.
// =====================================================

router.get(
  "/:token",
  async (req, res) => {

    try {

      const token =
        req.params.token;


      if (!token) {

        return res.status(400).json({

          error:
            "INVALID_CLAIM_TOKEN",

          message:
            "Claim token is required.",

        });

      }


      // =================================================
      // HASH TOKEN
      // =================================================

      const tokenHash =
        hashClaimToken(token);


      // =================================================
      // FIND REDEMPTION
      // =================================================

      const {
        data: redemption,
        error,
      } = await supabase

        .from("redemptions")

        .select(`
          id,
          amount_inr,
          points,
          status,
          claim_token_expires_at,
          user_id,
          users (
            name,
            email
          )
        `)

        .eq(
          "claim_token_hash",
          tokenHash
        )

        .maybeSingle();


      if (error) {

        console.error(
          "Claim lookup database error:",
          error
        );

        return res.status(500).json({

          error:
            "DATABASE_ERROR",

          message:
            "Unable to load reward.",

        });

      }


      if (!redemption) {

        return res.status(404).json({

          error:
            "INVALID_CLAIM_TOKEN",

          message:
            "This reward link is invalid.",

        });

      }


      // =================================================
      // CHECK EXPIRY
      // =================================================

      if (
        redemption.claim_token_expires_at &&
        new Date(
          redemption.claim_token_expires_at
        ) < new Date()
      ) {

        return res.status(410).json({

          error:
            "CLAIM_EXPIRED",

          message:
            "This reward claim link has expired.",

        });

      }


      // =================================================
      // CHECK STATUS
      // =================================================

      if (
        redemption.status !==
        "pending"
      ) {

        return res.status(409).json({

          error:
            "REDEMPTION_NOT_AVAILABLE",

          message:
            "This reward has already been processed.",

          status:
            redemption.status,

        });

      }


      // =================================================
      // RESPONSE
      // =================================================

      return res.json({

        success:
          true,

        redemption: {

          id:
            redemption.id,

          points:
            redemption.points,

          amountInr:
            redemption.amount_inr,

          recipientName:
            redemption.users?.name ||
            "",

          recipientEmail:
            redemption.users?.email ||
            "",

          expiresAt:
            redemption.claim_token_expires_at,

          status:
            redemption.status,

        },

      });


    } catch (error) {

      console.error(
        "Claim lookup error:",
        error
      );

      return res.status(500).json({

        error:
          "INTERNAL_SERVER_ERROR",

        message:
          "Unable to load reward.",

      });

    }

  }
);


// =====================================================
// CLAIM REWARD
// =====================================================
//
// POST /api/test-claims/:token/claim
//
// Body:
//
// {
//   "upiId": "testingh@upi"
// }
//
// IMPORTANT:
//
// The UPI ID is NOT stored in our database.
// It is only sent to the Razorpay TEST API.
// =====================================================

router.post(
  "/:token/claim",
  async (req, res) => {

    try {

      const token =
        req.params.token;


      const {
        upiId,
      } = req.body;


      // =================================================
      // VALIDATE TOKEN
      // =================================================

      if (!token) {

        return res.status(400).json({

          error:
            "INVALID_CLAIM_TOKEN",

        });

      }


      // =================================================
      // VALIDATE UPI
      // =================================================

      if (
        !upiId ||
        typeof upiId !==
          "string"
      ) {

        return res.status(400).json({

          error:
            "UPI_ID_REQUIRED",

          message:
            "UPI ID is required.",

        });

      }


      const normalizedUpi =
        upiId
          .trim()
          .toLowerCase();


      // =================================================
      // BASIC UPI VALIDATION
      // =================================================

      const upiRegex =
        /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/;


      if (
        !upiRegex.test(
          normalizedUpi
        )
      ) {

        return res.status(400).json({

          error:
            "INVALID_UPI_ID",

          message:
            "Enter a valid UPI ID.",

        });

      }


      // =================================================
      // HASH CLAIM TOKEN
      // =================================================

      const tokenHash =
        hashClaimToken(
          token
        );


      // =================================================
      // ATOMIC CLAIM LOCK
      // =================================================
      //
      // Allowed database statuses:
      //
      // pending
      // sent
      // claimed
      // expired
      // failed
      //
      // pending → sent
      //
      // The database function guarantees that only one
      // request can successfully claim the redemption.
      // =================================================

      const {
        data,
        error,
      } = await supabase.rpc(

        "claim_redemption_for_payout",

        {
          p_token_hash:
            tokenHash,
        }

      );


      if (error) {

        console.error(
          "Claim lock error:",
          error
        );

        return res.status(500).json({

          error:
            "DATABASE_ERROR",

          message:
            "Unable to claim reward.",

        });

      }


      // =================================================
      // TOKEN NOT AVAILABLE
      // =================================================

      if (
        !data ||
        data.length === 0
      ) {

        return res.status(409).json({

          error:
            "REDEMPTION_NOT_AVAILABLE",

          message:
            "This reward has already been claimed, is being processed, or has expired.",

        });

      }


      const redemption =
        data[0];


      console.log(
        "Redemption locked for payout:",
        redemption.redemption_id
      );


      // =================================================
      // CREATE RAZORPAY TEST PAYOUT
      // =================================================

      let payout;


      try {

        payout =
          await createTestUpiPayout({

            recipientName:
              redemption.user_name,

            recipientEmail:
              redemption.user_email,

            upiId:
              normalizedUpi,

            amountInr:
              Number(
                redemption.amount_inr
              ),

            // IMPORTANT:
            // SQL function returns redemption_id,
            // not id.
            referenceId:
              redemption.redemption_id,

          });


      } catch (payoutError) {

        console.error(
          "Razorpay TEST payout failed:",
          payoutError
        );


        // =================================================
        // PAYOUT FAILED
        // =================================================
        //
        // No payout was successfully created.
        //
        // sent → pending
        //
        // This allows the employee to retry.
        // =================================================

        const {
          error:
            rollbackError,
        } = await supabase

          .from("redemptions")

          .update({

            status:
              "pending",

            failure_reason:
              payoutError.message,

            updated_at:
              new Date().toISOString(),

          })

          .eq(
            "id",
            redemption.redemption_id
          )

          .eq(
            "status",
            "sent"
          );


        if (
          rollbackError
        ) {

          console.error(
            "Failed to rollback redemption:",
            rollbackError
          );

        }


        return res.status(500).json({

          error:
            "TEST_PAYOUT_FAILED",

          message:
            payoutError.message ||
            "Unable to create test payout.",

        });

      }


      // =================================================
      // SAVE RAZORPAY DETAILS
      // =================================================
      //
      // Razorpay has accepted the payout request.
      //
      // DO NOT mark claimed yet.
      //
      // sent = payout created / awaiting provider
      // claimed = provider confirms successful payout
      // =================================================

      const {
        data: updatedRedemption,
        error:
          updateError,
      } = await supabase

        .from("redemptions")

        .update({

          status:
            "sent",

          provider_status:
            payout.payoutStatus,

          razorpay_contact_id:
            payout.contactId,

          razorpay_fund_account_id:
            payout.fundAccountId,

          razorpay_payout_id:
            payout.payoutId,

          updated_at:
            new Date().toISOString(),

        })

        .eq(
          "id",
          redemption.redemption_id
        )

        .eq(
          "status",
          "sent"
        )

        .select()

        .single();


      // =================================================
      // DATABASE UPDATE FAILED
      // =================================================

      if (updateError) {

        console.error(
          "Failed to save payout:",
          updateError
        );


        /*
         * IMPORTANT:
         *
         * Razorpay payout may already have been created.
         *
         * DO NOT change the redemption back to pending.
         *
         * Otherwise another click could create another
         * payout.
         */

        return res.status(500).json({

          error:
            "PAYOUT_CREATED_DB_UPDATE_FAILED",

          message:
            "The test payout was created but could not be recorded. Manual reconciliation is required.",

        });

      }


      // =================================================
      // SUCCESS
      // =================================================

      return res.json({

        success:
          true,

        testMode:
          true,

        message:
          "Test payout created successfully.",

        redemption: {

          id:
            updatedRedemption.id,

          points:
            updatedRedemption.points,

          amountInr:
            updatedRedemption.amount_inr,

          status:
            updatedRedemption.status,

        },

        payout: {

          id:
            payout.payoutId,

          status:
            payout.payoutStatus,

        },

      });


    } catch (error) {

      console.error(
        "Claim reward error:",
        error
      );


      return res.status(500).json({

        error:
          "INTERNAL_SERVER_ERROR",

        message:
          "Unable to process reward.",

      });

    }

  }
);


// =====================================================
// EXPORT
// =====================================================

module.exports =
  router;