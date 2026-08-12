const express = require("express");

const crypto = require("crypto");

const supabase = require("../db/supabase");

const {
  createClaimToken,
} = require("../services/claimTokenService");

const {
  sendRewardClaimEmail,
} = require("../services/emailService");

const router = express.Router();


// =====================================================
// AUTH MIDDLEWARE
// =====================================================

function authenticate(req, res, next) {

  try {

    const auth =
      req.headers.authorization;


    if (
      !auth ||
      !auth.startsWith("Bearer ")
    ) {

      return res.status(401).json({
        error: "UNAUTHORIZED",
      });

    }


    const token =
      auth.substring(7);


    const jwt =
      require("jsonwebtoken");


    const decoded =
      jwt.verify(
        token,
        process.env.JWT_SECRET
      );


    req.user =
      decoded;


    next();


  } catch (error) {

    console.error(
      "Authentication error:",
      error
    );


    return res.status(401).json({
      error: "INVALID_TOKEN",
    });

  }

}


// =====================================================
// GET CURRENT BUSINESS MONTH - IST
// =====================================================
//
// IMPORTANT:
//
// redemptions.redemption_month is a PostgreSQL DATE.
//
// Therefore we store:
//
// 2026-08-01
// 2026-09-01
// 2026-10-01
//
// instead of:
//
// 2026-08
// 2026-09
// 2026-10
//
// The first day of the month represents that month.
// =====================================================

function getCurrentRedemptionMonth() {

  const now =
    new Date();


  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "Asia/Kolkata",

        year:
          "numeric",

        month:
          "2-digit",
      }
    ).formatToParts(now);


  const year =
    parts.find(
      (part) =>
        part.type === "year"
    )?.value;


  const month =
    parts.find(
      (part) =>
        part.type === "month"
    )?.value;


  if (
    !year ||
    !month
  ) {

    throw new Error(
      "Unable to determine redemption month."
    );

  }


  // PostgreSQL DATE
  //
  // Example:
  // 2026-08-01

  return `${year}-${month}-01`;

}


// =====================================================
// CREATE REDEMPTION + SEND EMAIL
// =====================================================
//
// POST
// /api/redemptions/:userId
//
// Admin clicks:
//
// 🎁 Send Gift Card
//
// IMPORTANT:
//
// Razorpay is NOT called here.
//
// We:
//
// 1. Read user's received balance
// 2. Create redemption
// 3. Reset received balance
// 4. Generate claim token
// 5. Email claim link
//
// Razorpay is called only after the employee enters
// their UPI ID on the claim page.
// =====================================================

router.post(
  "/:userId",
  authenticate,
  async (req, res) => {

    try {

      const admin =
        req.user;


      // =================================================
      // ADMIN ONLY
      // =================================================

      if (
        admin.role !==
        "admin"
      ) {

        return res.status(403).json({

          error:
            "ADMIN_ONLY",

          message:
            "Only organization admins can send rewards.",

        });

      }


      const userId =
        req.params.userId;


      // =================================================
      // GET USER
      // =================================================

      const {
        data: user,
        error: userError,
      } = await supabase

        .from("users")

        .select(`
          id,
          organization_id,
          name,
          email,
          received_balance
        `)

        .eq(
          "id",
          userId
        )

        .eq(
          "organization_id",
          admin.organizationId
        )

        .maybeSingle();


      if (
        userError
      ) {

        console.error(
          "Get user error:",
          userError
        );


        return res.status(500).json({

          error:
            "DATABASE_ERROR",

          message:
            "Unable to find employee.",

        });

      }


      if (!user) {

        return res.status(404).json({

          error:
            "USER_NOT_FOUND",

          message:
            "Employee does not exist in this organization.",

        });

      }


      // =================================================
      // CHECK EMAIL
      // =================================================

      if (
        !user.email
      ) {

        return res.status(400).json({

          error:
            "USER_EMAIL_MISSING",

          message:
            "This employee does not have an email address.",

        });

      }


      // =================================================
      // CHECK BALANCE
      // =================================================

      const points =
        Number(
          user.received_balance || 0
        );


      if (
        !Number.isFinite(points) ||
        points <= 0
      ) {

        return res.status(400).json({

          error:
            "NO_REDEEMABLE_BALANCE",

          message:
            "This user has no points available for redemption.",

        });

      }


      // =================================================
      // CONFIGURATION
      // =================================================

      const pointsToInr =
        Number(
          process.env.POINT_TO_INR_RATE ||
          10
        );


      const minimumRedemption =
        Number(
          process.env.MINIMUM_REDEMPTION_INR ||
          50
        );


      const expiryDays =
        Number(
          process.env.CLAIM_EXPIRY_DAYS ||
          7
        );


      if (
        !Number.isFinite(
          pointsToInr
        ) ||
        pointsToInr <= 0
      ) {

        throw new Error(
          "Invalid POINT_TO_INR_RATE configuration."
        );

      }


      if (
        !Number.isFinite(
          minimumRedemption
        ) ||
        minimumRedemption < 0
      ) {

        throw new Error(
          "Invalid MINIMUM_REDEMPTION_INR configuration."
        );

      }


      if (
        !Number.isFinite(
          expiryDays
        ) ||
        expiryDays <= 0
      ) {

        throw new Error(
          "Invalid CLAIM_EXPIRY_DAYS configuration."
        );

      }


      // =================================================
      // CALCULATE INR
      // =================================================

      const amountInr =
        points *
        pointsToInr;


      if (
        amountInr <
        minimumRedemption
      ) {

        return res.status(400).json({

          error:
            "BELOW_MINIMUM_REDEMPTION",

          message:
            `Minimum redemption is ₹${minimumRedemption}.`,

          points,

          amountInr,

          minimumRedemption,

        });

      }


      // =================================================
      // CLAIM TOKEN
      // =================================================

      const {
        token,
        hash,
      } =
        createClaimToken();


      // =================================================
      // CLAIM EXPIRY
      // =================================================

      const expiresAt =
        new Date(

          Date.now() +

          expiryDays *
          24 *
          60 *
          60 *
          1000

        ).toISOString();


      // =================================================
      // REDEMPTION MONTH
      // =================================================
      //
      // PostgreSQL DATE:
      //
      // 2026-08-01
      //
      // NOT:
      //
      // 2026-08
      //
      // =================================================

      const redemptionMonth =
        getCurrentRedemptionMonth();


      // =================================================
      // IDEMPOTENCY KEY
      // =================================================

      const idempotencyKey =
        `redemption-${user.id}-${Date.now()}-${crypto
          .randomUUID()
          .slice(0, 8)}`;


      // =================================================
      // CREATE REDEMPTION
      // =================================================

      const {
        data: redemption,
        error:
          redemptionError,
      } = await supabase

        .from("redemptions")

        .insert({

          organization_id:
            user.organization_id,

          user_id:
            user.id,

          redemption_month:
            redemptionMonth,

          points,
          conversion_rate:
            pointsToInr,    

          amount_inr:
            amountInr,

          status:
            "pending",

          claim_token_hash:
            hash,

          claim_token_expires_at:
            expiresAt,

          idempotency_key:
            idempotencyKey,

        })

        .select()

        .single();


      if (
        redemptionError
      ) {

        console.error(
          "Redemption creation failed:",
          redemptionError
        );


        return res.status(500).json({

          error:
            "REDEMPTION_CREATION_FAILED",

          message:
            redemptionError.message,

        });

      }


      console.log(
        "Redemption created:",
        {

          redemptionId:
            redemption.id,

          userId:
            user.id,

          redemptionMonth,

          points,

          amountInr,

        }
      );


      // =================================================
      // RESET RECEIVED BALANCE
      // =================================================

      const {
        error:
          balanceError,
      } = await supabase

        .from("users")

        .update({

          received_balance:
            0,

        })

        .eq(
          "id",
          user.id
        )

        .eq(
          "organization_id",
          admin.organizationId
        );


      if (
        balanceError
      ) {

        console.error(
          "Balance reset failed:",
          balanceError
        );


        // =================================================
        // ROLLBACK REDEMPTION
        // =================================================

        const {
          error:
            rollbackError,
        } = await supabase

          .from("redemptions")

          .delete()

          .eq(
            "id",
            redemption.id
          );


        if (
          rollbackError
        ) {

          console.error(
            "Redemption rollback failed:",
            rollbackError
          );

        }


        return res.status(500).json({

          error:
            "BALANCE_UPDATE_FAILED",

          message:
            "Unable to reset user's received balance.",

        });

      }


      // =================================================
      // CLAIM URL
      // =================================================

      const frontendUrl =
        (
          process.env.FRONTEND_URL ||
          "http://localhost:5173"
        ).replace(
          /\/$/,
          ""
        );


      const claimUrl =
        `${frontendUrl}/claim/${token}`;


      console.log(
        "Generated claim URL:",
        claimUrl
      );


      // =================================================
      // SEND EMAIL
      // =================================================

      let emailResult;


      try {

        emailResult =
          await sendRewardClaimEmail({

            recipientEmail:
              user.email,

            recipientName:
              user.name,

            amountInr,

            points,

            claimUrl,

            expiresAt,

          });


      } catch (emailError) {

        console.error(
          "Reward email failed:",
          emailError
        );


        // =================================================
        // RESTORE BALANCE
        // =================================================

        const {
          error:
            restoreError,
        } = await supabase

          .from("users")

          .update({

            received_balance:
              points,

          })

          .eq(
            "id",
            user.id
          )

          .eq(
            "organization_id",
            admin.organizationId
          );


        if (
          restoreError
        ) {

          console.error(
            "CRITICAL: Failed to restore balance:",
            restoreError
          );

        }


        // =================================================
        // DELETE REDEMPTION
        // =================================================

        const {
          error:
            deleteError,
        } = await supabase

          .from("redemptions")

          .delete()

          .eq(
            "id",
            redemption.id
          );


        if (
          deleteError
        ) {

          console.error(
            "Failed to rollback redemption:",
            deleteError
          );

        }


        return res.status(500).json({

          error:
            "EMAIL_SEND_FAILED",

          message:
            "Reward email could not be sent. No payout was created.",

        });

      }


      // =================================================
      // SUCCESS
      // =================================================

      return res.status(201).json({

        success:
          true,

        testMode:
          true,

        message:
          "Reward created and claim email sent.",

        redemption: {

          id:
            redemption.id,

          redemptionMonth,

          points,

          amountInr,

          status:
            "pending",

          expiresAt,

        },

        recipient: {

          name:
            user.name,

          email:
            user.email,

        },

        email: {

          sent:
            emailResult.success,

          messageId:
            emailResult.messageId,

        },

      });


    } catch (error) {

      console.error(
        "Create redemption error:",
        error
      );


      return res.status(500).json({

        error:
          "INTERNAL_SERVER_ERROR",

        message:
          error.message ||
          "Internal server error.",

      });

    }

  }
);


// =====================================================
// EXPORT
// =====================================================

module.exports =
  router;