const express =
  require("express");

const supabase =
  require("../db/supabase");

const authenticateToken =
  require("../middleware/auth");


const router =
  express.Router();


function requireAdmin(
  req,
  res,
  next
) {

  if (
    req.user.role !==
    "admin"
  ) {

    return res.status(403).json({

      error:
        "Only organization admins can send gift cards.",

    });

  }

  next();

}


router.post(

  "/redeem",

  authenticateToken,

  requireAdmin,

  async (req, res) => {

    try {

      const organizationId =
        req.user.organizationId;


      const {
        userId,
        points,
      } = req.body;


      if (!userId) {

        return res.status(400).json({

          error:
            "User ID is required.",

        });

      }


      if (
        !Number.isInteger(points) ||
        points <= 0
      ) {

        return res.status(400).json({

          error:
            "Points must be a positive integer.",

        });

      }


      const {
        data: user,
        error:
          userError,
      } = await supabase

        .from(
          "users"
        )

        .select(`
          id,
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
          organizationId
        )

        .eq(
          "is_active",
          true
        )

        .maybeSingle();


      if (userError) {

        console.error(
          userError
        );

        return res.status(500).json({

          error:
            "Failed to find employee.",

        });

      }


      if (!user) {

        return res.status(404).json({

          error:
            "Employee not found.",

        });

      }


      if (!user.email) {

        return res.status(400).json({

          error:
            "Employee does not have an email address.",

        });

      }


      if (
        user.received_balance <
        points
      ) {

        return res.status(400).json({

          error:
            `${user.name} only has ${user.received_balance} received points.`,

        });

      }


      const {
        data,
        error,
      } = await supabase.rpc(

        "create_gift_card_redemption",

        {

          p_organization_id:
            organizationId,

          p_user_id:
            userId,

          p_points:
            points,

        }

      );


      if (error) {

        console.error(
          "Gift card RPC error:",
          error
        );


        return res.status(400).json({

          error:
            "Failed to create gift card redemption.",

        });

      }


      return res.status(201).json({

        message:
          "Gift card redemption created.",

        redemption:
          data,

      });

    } catch (error) {

      console.error(
        "Gift card error:",
        error
      );

      return res.status(500).json({

        error:
          "Internal server error.",

      });

    }

  }

);


module.exports =
  router;