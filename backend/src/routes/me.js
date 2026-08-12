const express =
  require("express");

const supabase =
  require("../db/supabase");

const authenticateToken =
  require("../middleware/auth");


const router =
  express.Router();


router.get(
  "/",
  authenticateToken,
  async (req, res) => {

    try {

      const {
        data: user,
        error,
      } = await supabase
        .from("users")
        .select(`
          id,
          name,
          email,
          role,
          reward_balance,
          received_balance,
          organization_id,
          slack_user_id
        `)
        .eq(
          "id",
          req.user.userId
        )
        .single();


      if (error) {

        console.error(error);

        return res.status(500).json({
          error:
            "Failed to fetch user",
        });

      }


      return res.json({
        user,
      });


    } catch (error) {

      console.error(error);

      return res.status(500).json({
        error:
          "Internal server error",
      });

    }

  }
);


module.exports =
  router;